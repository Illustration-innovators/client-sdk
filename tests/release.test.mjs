import { describe, expect, it } from 'vitest';
import { calculatorDescriptor, namespaceWarnings, publicationEnabled, serverModuleEntry, SERVER_MODULE_PATH } from '../lib/descriptor.mjs';
import { buildMetadataFromGithub, createRelease, describeFiles, releaseIdFor, validateBuildMetadata, verifyExistingRelease } from '../lib/release.mjs';

const manifest = {
  schemaVersion: 1, runtimeContractVersion: 1,
  embedType: 'acme--tool', clientKey: 'acme', calculatorKey: 'tool',
  displayName: 'Acme Tool', description: 'A tool.',
  integration: { type: 'illustrata-products', productBinding: 'single', productContractKeys: ['acme-tool'], endpointRoles: ['pdf'], compatibleProductTypes: ['illustration-demo'] },
  deliveryModes: ['javascript', 'hosted-tool'],
};
const bytes = Buffer.from('console.log("widget")');
const COMMIT = 'b'.repeat(40);

describe('descriptor', () => {
  it('produces canonical key order', () => {
    expect(Object.keys(calculatorDescriptor(manifest))).toEqual(['schemaVersion', 'runtimeContractVersion', 'embedType', 'clientKey', 'calculatorKey', 'displayName', 'description', 'integration', 'deliveryModes']);
  });

  it('appends requiredCapabilities last and only for hosted-tool-only product tools', () => {
    const staff = { ...manifest, deliveryModes: ['hosted-tool'], requiredCapabilities: ['staff-workspace-v1'] };
    expect(Object.keys(calculatorDescriptor(staff)).at(-1)).toBe('requiredCapabilities');
    expect(() => calculatorDescriptor({ ...staff, deliveryModes: ['javascript', 'hosted-tool'] })).toThrow(/Hosted Tool-only/);
    expect(() => calculatorDescriptor({ ...manifest, requiredCapabilities: ['something-else'] })).toThrow();
  });

  it('accepts workspace-v1 with the same delivery rule', () => {
    const workspace = { ...manifest, deliveryModes: ['hosted-tool'], requiredCapabilities: ['workspace-v1'] };
    expect(calculatorDescriptor(workspace).requiredCapabilities).toEqual(['workspace-v1']);
    expect(() => calculatorDescriptor({ ...workspace, deliveryModes: ['iframe', 'hosted-tool'] })).toThrow(/Hosted Tool-only/);
    expect(() => calculatorDescriptor({ ...workspace, requiredCapabilities: ['workspace-v1', 'staff-workspace-v1'] })).toThrow();
  });

  it('rejects unknown product types, delivery modes and bad keys', () => {
    expect(() => calculatorDescriptor({ ...manifest, integration: { ...manifest.integration, compatibleProductTypes: ['acme-template'] } })).toThrow();
    expect(() => calculatorDescriptor({ ...manifest, deliveryModes: ['email'] })).toThrow();
    expect(() => calculatorDescriptor({ ...manifest, clientKey: 'Acme' })).toThrow();
    expect(() => calculatorDescriptor({ ...manifest, runtimeContractVersion: 2 })).toThrow(/Unsupported/);
  });

  it('reads publication and warns on names without the client prefix', () => {
    expect(publicationEnabled({})).toBe(false);
    expect(publicationEnabled({ publication: { independent: true } })).toBe(true);
    expect(() => publicationEnabled({ publication: { independent: 'yes' } })).toThrow();
    expect(namespaceWarnings(manifest)).toEqual([]);
    expect(namespaceWarnings({ ...manifest, embedType: 'acme-tool' })).toHaveLength(1);
  });

  it('allows a server module entry only for standalone tools', () => {
    expect(serverModuleEntry({ ...manifest, integration: { type: 'standalone' }, api: { entry: 'src/api.ts' } })).toBe('src/api.ts');
    expect(() => serverModuleEntry({ ...manifest, api: { entry: 'src/api.ts' } })).toThrow(/standalone/);
    expect(() => serverModuleEntry({ ...manifest, integration: { type: 'standalone' }, api: { entry: '../api.ts' } })).toThrow();
  });
});

describe('release identity', () => {
  it('is the hash of the sorted inventory, so identical bytes give the same release', () => {
    const first = createRelease(manifest, COMMIT, bytes);
    const second = createRelease(manifest, 'c'.repeat(40), Buffer.from(bytes));
    expect(first.releaseId).toBe(second.releaseId);
    expect(first.releaseId).toBe(releaseIdFor(first.files));
    expect(first.files.map(file => file.path)).toEqual(['assets/calculator.json', 'widget.js']);
    expect(first.integrity).toMatch(/^sha384-/);
    expect(createRelease(manifest, COMMIT, Buffer.from('other')).releaseId).not.toBe(first.releaseId);
  });

  it('rejects unsafe paths and short commits', () => {
    expect(() => describeFiles([{ path: '../x', bytes, contentType: 'text/plain' }])).toThrow(/path/);
    expect(() => describeFiles([{ path: 'release.json', bytes, contentType: 'application/json' }])).toThrow(/path/);
    expect(() => createRelease(manifest, 'abc', bytes)).toThrow(/commit/);
  });

  it('accepts a server module only at its fixed path', () => {
    const standalone = { ...manifest, integration: { type: 'standalone' } };
    const release = createRelease(standalone, COMMIT, bytes, undefined, [{ path: SERVER_MODULE_PATH, bytes: Buffer.from('export const contractVersion = 1;'), contentType: 'text/javascript' }]);
    expect(release.files.map(file => file.path)).toContain(SERVER_MODULE_PATH);
    expect(() => createRelease(standalone, COMMIT, bytes, undefined, [{ path: 'assets/other.mjs', bytes, contentType: 'text/javascript' }])).toThrow();
  });

  it('keeps the first publication provenance and refuses conflicting metadata', () => {
    const existing = createRelease(manifest, COMMIT, bytes);
    const later = createRelease(manifest, 'd'.repeat(40), bytes);
    expect(verifyExistingRelease(existing, later, bytes).sourceCommit).toBe(COMMIT);
    expect(() => verifyExistingRelease({ ...existing, embedType: 'acme--other' }, later, bytes)).toThrow();
    expect(() => verifyExistingRelease(existing, later, Buffer.from('tampered'))).toThrow();
  });
});

describe('build metadata', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_RUN_NUMBER: '42', GITHUB_RUN_ID: '123456' };
  it('uses the pull request title for merge commits', () => {
    const build = buildMetadataFromGithub(env, 'Merge pull request #7 from org/branch\n\nAdd the FIA results page', new Date('2026-11-06T10:00:00.000Z'));
    expect(build).toEqual({ number: 42, runId: '123456', builtAt: '2026-11-06T10:00:00.000Z', summary: 'Add the FIA results page' });
  });
  it('is absent outside GitHub Actions and strict about its keys', () => {
    expect(buildMetadataFromGithub({}, 'x')).toBeUndefined();
    expect(() => validateBuildMetadata({ number: 1, runId: '1', builtAt: '2026-11-06T10:00:00.000Z', summary: 'x', sdk: '0.1.0' })).toThrow();
  });
});
