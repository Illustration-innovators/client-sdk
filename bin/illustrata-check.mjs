#!/usr/bin/env node
// illustrata-check boundaries | removal | release | screenshots | sync | drift
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, runCli } from '../lib/args.mjs';
import { loadIllustrataConfig } from '../lib/config.mjs';
import { checkBoundaries } from '../lib/checks/boundaries.mjs';
import { checkRemoval, DEFAULT_REMOVAL_COMMANDS } from '../lib/checks/removal.mjs';
import { smokeTestRelease } from '../lib/checks/smoke.mjs';
import { screenshotRelease, DEFAULT_WIDTHS } from '../lib/checks/screenshots.mjs';
import { checkSync } from '../lib/checks/sync.mjs';
import { checkRuntimeDrift } from '../lib/checks/drift.mjs';
import { buildRelease } from '../lib/build.mjs';
import { SDK_VERSION } from '../lib/sdk.mjs';

const USAGE = `illustrata-check ${SDK_VERSION}

Usage:
  illustrata-check boundaries               Import rules between template, products and contract
  illustrata-check removal <product>        The UI still works with src/products/<product> deleted
  illustrata-check release [<release dir>]  Build (unless a dir is given) and mount the release in a
                                            simulated browser [--products <file.json>]
  illustrata-check screenshots [<release dir>]
                                            Build (unless a dir is given) and save a PNG per product
                                            and width in Chromium [--products <file.json>]
                                            [--out <dir>, default screenshots] [--widths 390,1280]
                                            Needs: npm i -D playwright && npx playwright install chromium
  illustrata-check sync [--strict]          Workflow reference and AGENTS.md match the installed SDK
  illustrata-check drift <runtime dir>      SDK runtime matches another copy (calculators tooling)`;

/** Accepts a release dir, an <embedType> dir, or a releases root holding one release. */
function findReleaseDir(dir) {
  if (existsSync(join(dir, 'release.json'))) return dir;
  const children = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  if (children.length !== 1) throw new Error(`Expected exactly one release under ${dir}; found ${children.length}. Pass the release directory itself.`);
  return findReleaseDir(join(dir, children[0]));
}

runCli(async (argv) => {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === 'help') { console.log(USAGE); return 0; }
  const root = process.cwd();
  const { config } = await loadIllustrataConfig(root, root);
  const checks = config.checks ?? {};

  if (command === 'boundaries') {
    parseArgs(rest);
    if (checks.boundaries === false) { console.log('Boundaries check turned off in illustrata.config.'); return 0; }
    const result = checkBoundaries({ root, srcDir: checks.boundaries?.srcDir });
    if (result.violations.length) {
      console.error(`Import boundary violations:\n\n  ${result.violations.join('\n  ')}\n\nShared code moves up into src/template; products never import each other; only src/products/registry.ts lists products.`);
      return 1;
    }
    console.log(`Boundaries OK: ${result.files} files, ${result.imports} relative imports checked.`);
    return 0;
  }

  if (command === 'removal') {
    const { positionals } = parseArgs(rest);
    checkRemoval({
      root,
      product: positionals[0],
      productsDir: checks.removal?.productsDir,
      registry: checks.removal?.registry,
      commands: checks.removal?.commands ?? DEFAULT_REMOVAL_COMMANDS,
      allowDirty: process.env.ILLUSTRATA_ALLOW_DIRTY === '1',
    });
    return 0;
  }

  if (command === 'release') {
    const { flags, positionals } = parseArgs(rest, { strings: ['products'] });
    const productsFile = flags.products ?? checks.smoke?.products;
    const products = productsFile ? JSON.parse(readFileSync(resolve(productsFile), 'utf8')) : [];
    let directory = positionals[0] ? findReleaseDir(resolve(positionals[0])) : null;
    let temporary = null;
    if (!directory) {
      temporary = join(tmpdir(), `illustrata-smoke-${process.pid}`);
      directory = (await buildRelease({ outDir: temporary, versionStamp: true })).directory;
    }
    try {
      const result = await smokeTestRelease({ directory, products });
      for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
      console.log(`Release smoke test passed: ${result.embedType} mounted ${result.elements} elements with a ${result.styleBytes}-byte stylesheet.`);
    } finally {
      if (temporary) rmSync(temporary, { recursive: true, force: true });
    }
    return 0;
  }

  if (command === 'screenshots') {
    const { flags, positionals } = parseArgs(rest, { strings: ['products', 'out', 'widths'] });
    const productsFile = flags.products ?? checks.smoke?.products;
    const products = productsFile ? JSON.parse(readFileSync(resolve(productsFile), 'utf8')) : [];
    const widths = flags.widths
      ? flags.widths.split(',').map(value => Number(value.trim()))
      : DEFAULT_WIDTHS;
    if (!widths.length || widths.some(width => !Number.isInteger(width) || width < 280 || width > 2560)) throw new Error('--widths takes comma-separated pixel widths between 280 and 2560');
    let directory = positionals[0] ? findReleaseDir(resolve(positionals[0])) : null;
    let temporary = null;
    if (!directory) {
      temporary = join(tmpdir(), `illustrata-screenshots-${process.pid}`);
      directory = (await buildRelease({ outDir: temporary, versionStamp: true })).directory;
    }
    try {
      const result = await screenshotRelease({ directory, outDir: resolve(flags.out ?? 'screenshots'), products, widths });
      console.log(`Saved ${result.files.length} screenshot(s) of ${result.embedType}:\n  ${result.files.join('\n  ')}`);
    } finally {
      if (temporary) rmSync(temporary, { recursive: true, force: true });
    }
    return 0;
  }

  if (command === 'sync') {
    const { flags } = parseArgs(rest, { booleans: ['strict'] });
    const { problems, notes } = checkSync({ root, strict: flags.strict });
    for (const note of notes) console.log(`Note: ${note}`);
    if (problems.length) { console.error(problems.join('\n')); return 1; }
    console.log(`In sync with @illustrata/client-sdk ${SDK_VERSION}.`);
    return 0;
  }

  if (command === 'drift') {
    const { positionals } = parseArgs(rest);
    if (!positionals[0]) throw new Error('Name the runtime directory to compare, e.g. ../calculators/tooling/widget-runtime');
    const { files, differences } = checkRuntimeDrift(positionals[0]);
    if (differences.length) { console.error(`Runtime drift (${differences.length}):\n  ${differences.join('\n  ')}`); return 1; }
    console.log(`No runtime drift: ${files} files match.`);
    return 0;
  }

  console.error(`Unknown command "${command}".\n\n${USAGE}`);
  return 1;
});
