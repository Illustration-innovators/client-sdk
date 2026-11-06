// Release metadata: inventory, release ID, integrity and build provenance.
//
// Ported unchanged in behaviour from the calculators repository
// (scripts/widget-release.mjs, main 2026-11-04). The platform registrar and the
// production maintenance task validate `release.json` strictly; keep its shape
// and key order identical.
import { createHash } from 'node:crypto';
import { calculatorDescriptor, SERVER_MODULE_PATH } from './descriptor.mjs';

/** Optional build outputs beyond widget.js and the descriptor. Only the server
 * Calculator API module exists today. */
function artifactExtras(extraFiles) {
  if (!Array.isArray(extraFiles)) throw new Error('Invalid artifact extras');
  return extraFiles.map(({ path, bytes, contentType }) => {
    if (path !== SERVER_MODULE_PATH || contentType !== 'text/javascript' || !Buffer.isBuffer(bytes) || !bytes.length) throw new Error('Invalid artifact extra');
    return { path, bytes, contentType };
  });
}

export function describeFiles(entries) {
  return entries.map(({ path, bytes, contentType }) => {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(path) || path.split('/').some(part => part === '..' || part === '.' || !part) || path === 'release.json') throw new Error('Invalid artifact path');
    return { path, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, contentType };
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function releaseIdFor(files) {
  if (new Set(files.map(file => file.path)).size !== files.length) throw new Error('Duplicate artifact path');
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}

export function validateBuildMetadata(build) {
  if (build === undefined) return undefined;
  if (!build || typeof build !== 'object' || Array.isArray(build)
    || Object.keys(build).sort().join(',') !== 'builtAt,number,runId,summary'
    || !Number.isSafeInteger(build.number) || build.number <= 0
    || typeof build.runId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(build.runId)
    || typeof build.builtAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(build.builtAt)
    || !Number.isFinite(Date.parse(build.builtAt)) || new Date(build.builtAt).toISOString() !== build.builtAt
    || typeof build.summary !== 'string' || build.summary.length < 1 || build.summary.length > 200
    || build.summary.trim() !== build.summary || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(build.summary)) {
    throw new Error('Invalid build metadata');
  }
  return { number: build.number, runId: build.runId, builtAt: build.builtAt, summary: build.summary };
}

export function buildMetadataFromGithub(env, commitMessage, now = new Date()) {
  if (env.GITHUB_ACTIONS !== 'true') return undefined;
  if (!/^\d+$/.test(env.GITHUB_RUN_NUMBER ?? '')) throw new Error('Invalid GitHub build number');
  const [subject = '', ...body] = commitMessage.split(/\r?\n/);
  const title = /^Merge pull request #[1-9][0-9]* from .+$/.test(subject.trim())
    ? body.find(line => line.trim()) ?? subject
    : subject;
  // GitHub merge bodies begin with the PR title. All titles remain display text.
  const summary = title.replace(/[\s\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, 200).trimEnd();
  return validateBuildMetadata({ number: Number(env.GITHUB_RUN_NUMBER), runId: env.GITHUB_RUN_ID, builtAt: now.toISOString(), summary });
}

export function createRelease(manifest, sourceCommit, bytes, buildMetadata, extraFiles = []) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('Full source commit required');
  if (manifest.schemaVersion !== 1 || manifest.runtimeContractVersion !== 1) throw new Error('Unsupported calculator contract');
  const calculator = manifest.calculator !== undefined ? calculatorDescriptor(manifest.calculator) : manifest.integration !== undefined ? calculatorDescriptor(manifest) : undefined;
  if (calculator && ['embedType', 'clientKey', 'calculatorKey', 'deliveryModes'].some(key => JSON.stringify(calculator[key]) !== JSON.stringify(manifest[key]))) throw new Error('Calculator descriptor identity mismatch');
  const files = describeFiles([{ path: 'widget.js', bytes, contentType: 'application/javascript' }, ...(calculator ? [{ path: 'assets/calculator.json', bytes: Buffer.from(JSON.stringify(calculator)), contentType: 'application/json' }] : []), ...artifactExtras(extraFiles)]);
  const build = validateBuildMetadata(buildMetadata);
  return {
    schemaVersion: 1, runtimeContractVersion: 1,
    embedType: manifest.embedType, clientKey: manifest.clientKey, calculatorKey: manifest.calculatorKey,
    sourceCommit, entrypoint: 'widget.js', files, releaseId: releaseIdFor(files),
    integrity: 'sha384-' + createHash('sha384').update(bytes).digest('base64'),
    deliveryModes: manifest.deliveryModes,
    ...(calculator ? { calculator } : {}),
    ...(build === undefined ? {} : { build }),
  };
}

/** Accept identical bytes from a later commit while retaining first publication provenance. */
export function verifyExistingRelease(existing, candidate, bytes, extraFiles = []) {
  if (!existing || typeof existing !== 'object') throw new Error('Invalid existing release metadata');
  const verified = createRelease(existing, existing.sourceCommit, bytes, existing.build, extraFiles);
  validateBuildMetadata(candidate.build);
  for (const key of Object.keys(verified)) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(verified[key])) throw new Error(`Invalid existing release metadata: ${key}`);
    if (!['sourceCommit', 'build'].includes(key) && JSON.stringify(existing[key]) !== JSON.stringify(candidate[key])) throw new Error(`Conflicting existing release metadata: ${key}`);
  }
  return existing;
}
