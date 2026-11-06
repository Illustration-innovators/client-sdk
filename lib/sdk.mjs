import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of the installed SDK package. */
export const SDK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(readFileSync(resolve(SDK_ROOT, 'package.json'), 'utf8'));

export const SDK_NAME = pkg.name;
export const SDK_VERSION = pkg.version;

/** The reusable workflow client repositories call, without the `@ref`. */
export const PUBLISH_WORKFLOW = 'Illustration-innovators/client-sdk/.github/workflows/publish-release.yml';

/** Comment prepended to every widget.js the SDK builds. */
export function versionStamp() {
  return `/*! ${SDK_NAME} ${SDK_VERSION} */\n`;
}
