import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SDK = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURE = join(SDK, 'fixtures/tailwind-client');
export const COMMIT = 'a'.repeat(40);

export function tempDir(prefix = 'illustrata-sdk-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export const fixtureProducts = [
  { slug: 'fixture-fia', name: 'Fixture FIA', allowedStates: null, variants: [{ id: 'fia-10', displayName: 'FIA 10', sparkProductCode: 'FIA10', kind: 'fia-accum', displayOrder: 1, allowedStates: null }] },
];

/**
 * An in-memory S3 that mimics the parts of `aws s3api` the publisher uses:
 * conditional put (if-none-match), head-object with SHA-256 checksum and
 * get-object to a file.
 */
export function fakeS3() {
  const objects = new Map();
  const calls = [];
  const arg = (args, name) => args[args.indexOf(name) + 1];
  const aws = (args) => {
    const [, op] = args;
    const key = arg(args, '--key');
    calls.push(`${op} ${key}`);
    if (op === 'put-object') {
      if (objects.has(key)) throw Object.assign(new Error('exists'), { stderr: 'An error occurred (PreconditionFailed)' });
      const body = readFileSync(arg(args, '--body'));
      objects.set(key, { body, contentType: arg(args, '--content-type') });
      return '';
    }
    if (op === 'head-object') {
      const object = objects.get(key);
      if (!object) throw new Error(`NoSuchKey ${key}`);
      return JSON.stringify({ ContentType: object.contentType, ContentLength: object.body.length, ChecksumSHA256: createHash('sha256').update(object.body).digest('base64') });
    }
    if (op === 'get-object') {
      const object = objects.get(key);
      const path = args[args.length - 1];
      if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, object.body);
      return '';
    }
    throw new Error(`Unexpected aws call: ${args.join(' ')}`);
  };
  return { aws, objects, calls };
}
