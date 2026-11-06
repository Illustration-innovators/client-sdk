// Publishes one built release to the staging release bucket.
//
// Ported from the calculators repository (scripts/publish-widget-candidate.mjs,
// main 2026-11-04). Every write is conditional (if-none-match), release.json
// goes last as the completion marker, and an existing release is accepted only
// when its bytes and identity match. The AWS role decides which release paths
// this repository may write; nothing here widens that.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRelease, verifyExistingRelease } from './release.mjs';
import { SERVER_MODULE_PATH } from './descriptor.mjs';

const listing = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? listing(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]);

/** Loads and fully re-verifies the single release under `releasesRoot`. */
export function loadVerifiedRelease(releasesRoot, expectedCommit) {
  const root = resolve(releasesRoot);
  const directories = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory());
  if (directories.length !== 1) throw new Error('Exactly one calculator artifact required');
  const embedType = directories[0].name;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(embedType)) throw new Error('Invalid embed type');
  const releases = readdirSync(join(root, embedType));
  if (releases.length !== 1 || !/^[a-f0-9]{64}$/.test(releases[0])) throw new Error('Exactly one immutable release required');
  const releaseId = releases[0];
  const directory = join(root, embedType, releaseId);
  const release = JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8'));
  const bytes = readFileSync(join(directory, 'widget.js'));
  const hasCalculator = release.calculator !== undefined;
  const hasServerModule = Array.isArray(release.files) && release.files.some(file => file.path === SERVER_MODULE_PATH);
  const expectedListing = ['release.json', 'widget.js', ...(hasCalculator ? ['assets/calculator.json'] : []), ...(hasServerModule ? [SERVER_MODULE_PATH] : [])].sort();
  if (listing(directory).sort().join(',') !== expectedListing.join(',')) throw new Error('Unexpected artifact contents');
  if (hasCalculator && !readFileSync(join(directory, 'assets/calculator.json')).equals(Buffer.from(JSON.stringify(release.calculator)))) throw new Error('Calculator descriptor bytes mismatch');
  const extraFiles = hasServerModule ? [{ path: SERVER_MODULE_PATH, bytes: readFileSync(join(directory, SERVER_MODULE_PATH)), contentType: 'text/javascript' }] : [];
  const expected = createRelease(release, release.sourceCommit, bytes, release.build, extraFiles);
  if (release.releaseId !== releaseId || release.embedType !== embedType || expected.releaseId !== releaseId || expected.integrity !== release.integrity || JSON.stringify(expected.files) !== JSON.stringify(release.files) || JSON.stringify(expected.calculator) !== JSON.stringify(release.calculator)) throw new Error('Artifact digest verification failed');
  if (expectedCommit !== undefined && release.sourceCommit !== expectedCommit) throw new Error('Artifact source does not match workflow');
  return { embedType, releaseId, directory, release, bytes, extraFiles };
}

function awsCli(args, options) {
  return execFileSync('aws', args, options);
}

/**
 * @param {object} options
 * @param {string} [options.releasesRoot] Default: dist/widget-releases.
 * @param {string} options.bucket
 * @param {string} options.expectedCommit  Usually GITHUB_SHA.
 * @param {(args: string[], options: object) => any} [options.aws] Injectable for tests.
 */
export function publishRelease(options) {
  const bucket = options.bucket;
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Release bucket required');
  if (!options.expectedCommit) throw new Error('Expected source commit required (GITHUB_SHA)');
  const aws = options.aws ?? awsCli;
  const log = options.log ?? console.log;
  const { embedType, releaseId, directory, release, bytes, extraFiles } = loadVerifiedRelease(options.releasesRoot ?? 'dist/widget-releases', options.expectedCommit);
  for (const [name, contentType] of [...release.files.map(file => [file.path, file.contentType]), ['release.json', 'application/json']]) {
    const key = `widget/releases/${embedType}/${releaseId}/${name}`;
    const local = join(directory, name);
    const checksum = createHash('sha256').update(readFileSync(local)).digest('base64');
    // Conditional writes make retry safe without overwriting an existing release.
    try {
      aws(['s3api', 'put-object', '--bucket', bucket, '--key', key, '--body', local, '--content-type', contentType, '--cache-control', 'public,max-age=31536000,immutable', '--checksum-sha256', checksum, '--if-none-match', '*'], { stdio: 'pipe' });
    } catch (error) {
      const details = String(error.stderr ?? '');
      if (!details.includes('PreconditionFailed')) throw error;
    }
    const remote = JSON.parse(aws(['s3api', 'head-object', '--bucket', bucket, '--key', key, '--checksum-mode', 'ENABLED'], { encoding: 'utf8' }));
    if (name === 'release.json') {
      if (remote.ContentType !== contentType || !Number.isSafeInteger(remote.ContentLength) || remote.ContentLength < 1 || remote.ContentLength > 1_000_000) throw new Error('Invalid remote release metadata');
      const temporary = mkdtempSync(join(tmpdir(), 'illustrata-release-'));
      try {
        const path = join(temporary, 'release.json');
        aws(['s3api', 'get-object', '--bucket', bucket, '--key', key, '--range', 'bytes=0-999999', path], { stdio: 'pipe' });
        const original = readFileSync(path);
        if (original.length !== remote.ContentLength || createHash('sha256').update(original).digest('base64') !== remote.ChecksumSHA256) throw new Error('Remote metadata checksum mismatch');
        const canonical = verifyExistingRelease(JSON.parse(original.toString('utf8')), release, bytes, extraFiles);
        log(`Canonical release source commit: ${canonical.sourceCommit}`);
      } finally { rmSync(temporary, { recursive: true, force: true }); }
      continue;
    }
    if (remote.ChecksumSHA256 !== checksum || remote.ContentLength !== readFileSync(local).length || remote.ContentType !== contentType) throw new Error(`Remote verification failed: ${key}`);
  }
  log(`Published ${embedType}/${releaseId} to staging. Nothing was activated; select it in the admin portal.`);
  return { embedType, releaseId };
}
