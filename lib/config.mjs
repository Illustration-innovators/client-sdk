// Loads a repository's illustrata.config.{ts,mts,js,mjs}.
//
// The config holds the build settings that vary per repository (Vite plugins
// such as Tailwind, CSS options) and the optional per-repository hooks. Vite
// bundles a TypeScript config the same way it bundles vite.config.ts.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_FILES = ['illustrata.config.ts', 'illustrata.config.mts', 'illustrata.config.mjs', 'illustrata.config.js'];

const ALLOWED_KEYS = new Set(['plugins', 'css', 'entry', 'buildQuery', 'checks']);
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function findConfigFile(...directories) {
  for (const directory of directories) {
    for (const name of CONFIG_FILES) {
      const path = join(directory, name);
      if (existsSync(path)) return path;
    }
  }
  return null;
}

export function validateConfig(config, path = 'illustrata config') {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`${path} must export an object`);
  const unknown = Object.keys(config).filter(key => !ALLOWED_KEYS.has(key));
  if (unknown.length) throw new Error(`${path} has unsupported keys: ${unknown.join(', ')}`);
  if (config.plugins !== undefined && !Array.isArray(config.plugins)) throw new Error(`${path}: plugins must be an array`);
  for (const plugin of (config.plugins ?? []).flat(Infinity)) {
    if (plugin && typeof plugin === 'object' && typeof plugin.name === 'string' && plugin.name.startsWith('vite:react')) {
      throw new Error(`${path}: do not include @vitejs/plugin-react; the SDK builder adds it`);
    }
  }
  if (config.css !== undefined && (!config.css || typeof config.css !== 'object')) throw new Error(`${path}: css must be an object`);
  if (config.entry !== undefined && (typeof config.entry !== 'string' || !/^src\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|mjs)$/.test(config.entry) || config.entry.includes('..'))) {
    throw new Error(`${path}: entry must be a path under src/`);
  }
  if (config.buildQuery !== undefined) {
    const query = config.buildQuery;
    if (!query || typeof query !== 'object' || typeof query.from !== 'string' || typeof query.export !== 'string'
      || query.from.includes('..') || !/^[A-Za-z0-9_./-]+\.(?:ts|js|mjs)$/.test(query.from) || !IDENTIFIER.test(query.export)) {
      throw new Error(`${path}: buildQuery must be { from: "<relative module>", export: "<name>" }`);
    }
  }
  if (config.checks !== undefined && (!config.checks || typeof config.checks !== 'object')) throw new Error(`${path}: checks must be an object`);
  return config;
}

/**
 * Loads the first config file found in `toolDir`, then `rootDir`. Returns an
 * empty config when there is none, which is the calculators repository's case.
 */
export async function loadIllustrataConfig(toolDir, rootDir = toolDir) {
  const path = findConfigFile(toolDir, rootDir);
  if (!path) return { path: null, config: {} };
  const { loadConfigFromFile } = await import('vite');
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path, rootDir, 'silent');
  return { path, config: validateConfig(loaded?.config ?? {}, path) };
}
