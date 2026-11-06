import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRelease } from '../lib/build.mjs';
import { loadVerifiedRelease, publishRelease } from '../lib/publish.mjs';
import { smokeTestRelease } from '../lib/checks/smoke.mjs';
import { screenshotRelease, screenshotName } from '../lib/checks/screenshots.mjs';
import { SDK_VERSION } from '../lib/sdk.mjs';
import { COMMIT, FIXTURE, fakeS3, fixtureProducts, tempDir } from './support.mjs';

let built;
let outDir;

beforeAll(async () => {
  outDir = tempDir();
  built = await buildRelease({ root: FIXTURE, outDir, sourceCommit: COMMIT, env: {}, logLevel: 'silent' });
});

describe('builder', () => {
  it("compiles the repository's Tailwind setup into the bundle", () => {
    const code = built.bytes.toString('utf8');
    expect(code).toContain('.bg-fixture-accent');
    expect(code).not.toContain('@tailwind utilities');
    // The Shadow DOM fallback re-declares Tailwind's @property defaults.
    expect(code).toMatch(/::backdrop\{[^}]*--tw-border-style:solid/);
  });

  it('stamps the SDK version and can leave it out', async () => {
    expect(built.bytes.toString('utf8').startsWith(`/*! @illustrata/client-sdk ${SDK_VERSION} */\n`)).toBe(true);
    const unstamped = await buildRelease({ root: FIXTURE, sourceCommit: COMMIT, env: {}, write: false, versionStamp: false, logLevel: 'silent' });
    expect(unstamped.bytes.toString('utf8').startsWith('/*!')).toBe(false);
  });

  it('is reproducible: a rebuild gives the same release ID', async () => {
    const again = await buildRelease({ root: FIXTURE, sourceCommit: 'e'.repeat(40), env: {}, write: false, logLevel: 'silent' });
    expect(again.release.releaseId).toBe(built.release.releaseId);
  });

  it('refuses to build for publishing when publication is off', async () => {
    const copy = tempDir();
    cpSync(FIXTURE, copy, { recursive: true });
    const manifestPath = join(copy, 'calculator.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, publication: { independent: false } }));
    await expect(buildRelease({ root: copy, sourceCommit: COMMIT, env: {}, write: false, requirePublication: true, logLevel: 'silent' })).rejects.toThrow(/publication.independent/);
  });
});

describe('smoke test', () => {
  it('mounts the release in a Shadow DOM with its stylesheet and products', async () => {
    const result = await smokeTestRelease({ directory: built.directory, products: fixtureProducts });
    expect(result.embedType).toBe('fixture--tailwind-client');
    expect(result.styleBytes).toBeGreaterThan(1000);
    expect(result.warnings).toEqual([]);
  });

  it('passes without products when the UI renders static content', async () => {
    const result = await smokeTestRelease({ directory: built.directory });
    expect(result.warnings).toEqual([]);
  });
});

// Needs Chromium from `npx playwright install chromium`; CI installs it.
const chromium = await import('playwright').then(({ chromium }) => existsSync(chromium.executablePath())).catch(() => false);

describe('screenshots', () => {
  it.skipIf(!chromium)('saves a full-page PNG per product and width from real Chromium', async () => {
    const outDir = tempDir('illustrata-screens-');
    const result = await screenshotRelease({ directory: built.directory, outDir, products: fixtureProducts, widths: [390, 1024] });
    expect(result.files.map(file => file.split('/').pop())).toEqual(['fixture-fia-390.png', 'fixture-fia-1024.png']);
    for (const file of result.files) expect(readFileSync(file).subarray(1, 4).toString()).toBe('PNG');
  }, 60_000);
  it('names files from the product, safely', () => {
    expect(screenshotName({ slug: 'Fixture FIA / 10' }, 0)).toBe('fixture-fia-10');
    expect(screenshotName({}, 2)).toBe('product-3');
    expect(screenshotName({ slug: '../../etc' }, 0)).toBe('etc');
  });
});

describe('publisher', () => {
  it('verifies the release and uploads release.json last', () => {
    const s3 = fakeS3();
    const result = publishRelease({ releasesRoot: outDir, bucket: 'illustrata-test-bucket', expectedCommit: COMMIT, aws: s3.aws, log: () => {} });
    expect(result.releaseId).toBe(built.release.releaseId);
    const puts = s3.calls.filter(call => call.startsWith('put-object')).map(call => call.split('/').pop());
    expect(puts.at(-1)).toBe('release.json');
    expect(puts).toEqual(expect.arrayContaining(['widget.js', 'calculator.json', 'release.json']));
  });

  it('is safe to retry: an identical release is accepted, not overwritten', () => {
    const s3 = fakeS3();
    publishRelease({ releasesRoot: outDir, bucket: 'illustrata-test-bucket', expectedCommit: COMMIT, aws: s3.aws, log: () => {} });
    const sizeBefore = s3.objects.size;
    publishRelease({ releasesRoot: outDir, bucket: 'illustrata-test-bucket', expectedCommit: COMMIT, aws: s3.aws, log: () => {} });
    expect(s3.objects.size).toBe(sizeBefore);
  });

  it('refuses a release built from a different commit than the workflow', () => {
    expect(() => publishRelease({ releasesRoot: outDir, bucket: 'illustrata-test-bucket', expectedCommit: 'f'.repeat(40), aws: fakeS3().aws, log: () => {} })).toThrow(/source does not match/);
  });

  it('refuses tampered bytes before any upload', () => {
    const copy = tempDir();
    cpSync(outDir, copy, { recursive: true });
    const { directory } = loadVerifiedRelease(copy);
    writeFileSync(join(directory, 'widget.js'), 'tampered');
    const s3 = fakeS3();
    expect(() => publishRelease({ releasesRoot: copy, bucket: 'illustrata-test-bucket', expectedCommit: COMMIT, aws: s3.aws, log: () => {} })).toThrow(/digest verification/);
    expect(s3.calls).toEqual([]);
  });

  it('requires a valid bucket name', () => {
    expect(() => publishRelease({ releasesRoot: outDir, bucket: 'Not A Bucket', expectedCommit: COMMIT, aws: fakeS3().aws })).toThrow(/bucket/);
  });
});
