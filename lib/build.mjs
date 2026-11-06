// Builds one release: widget.js (+ optional server module), the canonical
// descriptor and release.json, under <outDir>/<embedType>/<releaseId>/.
//
// Derived from the calculators repository's scripts/build-widget.mjs
// (main 2026-11-04) with three changes:
// 1. The tool is a directory with calculator.manifest.json, not a
//    clients/<client>/calculators/<name> workspace.
// 2. The repository's own Vite plugins and CSS options (illustrata.config)
//    are applied, so Tailwind/PostCSS styles reach the bundle.
// 3. The calculator-specific query builder is a config hook, not a hard-coded
//    special case.
// Everything that must not vary is still enforced here: one self-contained
// IIFE, no environment files or variables, production mode.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { calculatorDescriptor, namespaceWarnings, publicationEnabled, readManifest, SERVER_MODULE_PATH, serverModuleEntry } from './descriptor.mjs';
import { buildMetadataFromGithub, createRelease, verifyExistingRelease } from './release.mjs';
import { loadIllustrataConfig } from './config.mjs';
import { commitMessageFor, sourceCommitFor } from './git.mjs';
import { SDK_ROOT, versionStamp } from './sdk.mjs';

const RUNTIME_ENTRY = resolve(SDK_ROOT, 'src/runtime/mount-calculator.tsx');
const NO_ENV_PREFIX = '__ILLUSTRATA_NO_BUILD_ENV__';

function virtualEntry(code) {
  return {
    name: 'illustrata-widget-entry',
    resolveId(id) { if (id.endsWith('/__widget_entry__.js')) return '\0virtual:widget'; },
    load(id) { if (id === '\0virtual:widget') return code; },
  };
}

/**
 * Runs `work` with NODE_ENV=production. Vite and the React plugin derive
 * production mode from NODE_ENV when it is already set, so a shell or test
 * runner with NODE_ENV=development/test would otherwise compile development
 * JSX that production React cannot run. Vite sets the same value itself when
 * NODE_ENV is unset, so forcing it never changes release bytes.
 */
async function inProduction(work) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return await work();
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function singleChunk(result, message) {
  const output = Array.isArray(result) ? result.flatMap(r => r.output) : result.output;
  if (output.length !== 1 || output[0].type !== 'chunk' || output[0].imports.length || output[0].dynamicImports.length) throw new Error(message);
  return Buffer.from(output[0].code);
}

/**
 * @param {object} options
 * @param {string} [options.dir]        Tool directory (holds calculator.manifest.json). Default: cwd.
 * @param {string} [options.root]       Vite root and dependency root. Default: cwd.
 * @param {string} [options.outDir]     Output root. Default: <root>/dist/widget-releases.
 * @param {string} [options.sourceCommit]
 * @param {boolean} [options.versionStamp]  Prepend the SDK version comment. Default: true.
 * @param {boolean} [options.requirePublication] Fail unless publication.independent is true.
 * @param {boolean} [options.write]     Write the release to disk. Default: true.
 */
export async function buildRelease(options = {}) {
  const env = options.env ?? process.env;
  const root = resolve(options.root ?? process.cwd());
  const toolDir = resolve(root, options.dir ?? '.');
  const manifest = readManifest(toolDir);
  if (options.requirePublication && !publicationEnabled(manifest)) {
    throw new Error(`${manifest.embedType}: publication.independent is not true in calculator.manifest.json`);
  }
  const warnings = namespaceWarnings(manifest);
  const { path: configPath, config } = await loadIllustrataConfig(toolDir, root);
  const sourceCommit = options.sourceCommit ?? sourceCommitFor(toolDir, env);

  const entryModule = join(toolDir, config.entry ?? 'src/index.ts');
  const query = config.buildQuery;
  const queryImport = query ? `import { ${query.export} } from ${JSON.stringify(join(toolDir, query.from))};` : '';
  const entry = `import { Calculator, CALCULATOR_CSS } from ${JSON.stringify(entryModule)};
import { runCalculator } from ${JSON.stringify(RUNTIME_ENTRY)};
${queryImport}
runCalculator(${JSON.stringify(manifest.embedType)}, Calculator, CALCULATOR_CSS, ${manifest.integration.type === 'illustrata-products'}${query ? `, ${query.export}` : ''});`;

  const { build } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const result = await inProduction(() => build({
    configFile: false, envFile: false, envPrefix: NO_ENV_PREFIX, root, mode: 'production', logLevel: options.logLevel ?? 'warn',
    plugins: [react(), ...(config.plugins ?? []), virtualEntry(entry)],
    ...(config.css ? { css: config.css } : {}),
    resolve: { dedupe: ['react', 'react-dom'] },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, sourcemap: false, target: 'es2020', minify: 'esbuild', lib: { entry: resolve(root, '__widget_entry__.js'), name: 'IllustrataCalculator', formats: ['iife'] }, rollupOptions: { output: { inlineDynamicImports: true } } },
  }));
  // CSS must be exported as a string and assets inlined. Never publish an incomplete graph.
  const built = singleChunk(result, 'Widget must be one self-contained JavaScript bundle');
  const bytes = options.versionStamp === false ? built : Buffer.concat([Buffer.from(versionStamp()), built]);

  // Optional server-side Calculator API module: one self-contained ES module with
  // no imports (not even node: built-ins), assets inlined like the widget's.
  const extraFiles = [];
  const apiEntry = serverModuleEntry(manifest);
  if (apiEntry) {
    const server = await inProduction(() => build({
      configFile: false, envFile: false, envPrefix: NO_ENV_PREFIX, root, mode: 'production', logLevel: options.logLevel ?? 'warn',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: { write: false, sourcemap: false, target: 'node22', minify: 'esbuild', lib: { entry: join(toolDir, apiEntry), formats: ['es'], fileName: 'api' }, rollupOptions: { output: { inlineDynamicImports: true } } },
    }));
    extraFiles.push({ path: SERVER_MODULE_PATH, bytes: singleChunk(server, 'Calculator API module must be one self-contained ES module with no imports'), contentType: 'text/javascript' });
  }

  let release = createRelease(manifest, sourceCommit, bytes, buildMetadataFromGithub(env, commitMessageFor(toolDir, sourceCommit, env)), extraFiles);
  const directory = resolve(root, options.outDir ?? 'dist/widget-releases', manifest.embedType, release.releaseId);
  if (options.write !== false) {
    mkdirSync(join(directory, 'assets'), { recursive: true });
    if (extraFiles.length) mkdirSync(join(directory, 'assets/server'), { recursive: true });
    const descriptor = release.calculator ? [['assets/calculator.json', Buffer.from(JSON.stringify(release.calculator))]] : [];
    for (const [name, body] of [['widget.js', bytes], ...descriptor, ...extraFiles.map(file => [file.path, file.bytes]), ['release.json', Buffer.from(JSON.stringify(release, null, 2) + '\n')]]) {
      const path = join(directory, name);
      try { writeFileSync(path, body, { flag: 'wx' }); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (name === 'release.json') release = verifyExistingRelease(JSON.parse(readFileSync(path, 'utf8')), release, bytes, extraFiles);
        else if (!readFileSync(path).equals(body)) throw error;
      }
    }
  }
  return { directory, release, bytes, configPath, warnings, descriptor: calculatorDescriptor(manifest) };
}
