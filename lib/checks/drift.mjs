// Runtime drift check: compares the SDK's runtime with another copy of it
// (the calculators repository's tooling/widget-runtime until it adopts the
// SDK). Only the contract import paths are expected to differ.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { SDK_ROOT } from '../sdk.mjs';

const RUNTIME_DIR = join(SDK_ROOT, 'src/runtime');
const IGNORED = new Set(['tsconfig.json']);

function files(dir, base = dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full, base);
    return IGNORED.has(entry) ? [] : [relative(base, full).split(sep).join('/')];
  });
}

/** Normalizes the one line that differs by repository: where contract types live. */
export function normalizeRuntimeSource(text) {
  return text.replace(/from\s+["'][./]+(?:packages\/calculator-contract\/src\/index|contract\/index)["']/g, 'from "<contract>"');
}

export function checkRuntimeDrift(otherDir) {
  const other = resolve(otherDir);
  if (!existsSync(other)) throw new Error(`No runtime directory at ${other}`);
  const mine = new Set(files(RUNTIME_DIR));
  const theirs = new Set(files(other));
  const differences = [];
  for (const path of [...new Set([...mine, ...theirs])].sort()) {
    if (!mine.has(path)) { differences.push(`only in ${other}: ${path}`); continue; }
    if (!theirs.has(path)) { differences.push(`only in the SDK: ${path}`); continue; }
    const a = normalizeRuntimeSource(readFileSync(join(RUNTIME_DIR, path), 'utf8'));
    const b = normalizeRuntimeSource(readFileSync(join(other, path), 'utf8'));
    if (a !== b) differences.push(`differs: ${path}`);
  }
  return { files: mine.size, differences };
}
