import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBoundaries } from '../lib/checks/boundaries.mjs';
import { registryWithout } from '../lib/checks/removal.mjs';
import { checkSync, SHARED_END, SHARED_START, sharedAgentsBlock } from '../lib/checks/sync.mjs';
import { normalizeRuntimeSource } from '../lib/checks/drift.mjs';
import { validateConfig } from '../lib/config.mjs';
import { PUBLISH_WORKFLOW, SDK_VERSION } from '../lib/sdk.mjs';
import { tempDir } from './support.mjs';

function write(root, path, text) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

describe('boundaries', () => {
  it('allows the scaffold layout', () => {
    const root = tempDir();
    write(root, 'calculator.manifest.json', '{}');
    write(root, 'src/index.ts', 'import manifest from "../calculator.manifest.json";\nexport * from "./Calculator";');
    write(root, 'src/Calculator.tsx', 'import { PRODUCT_MODULES } from "./products/registry";\nimport { Shell } from "./template/Shell";');
    write(root, 'src/template/Shell.tsx', 'import type { X } from "../contract/index";');
    write(root, 'src/contract/index.ts', 'export type X = 1;');
    write(root, 'src/products/registry.ts', 'import { fia } from "./fia/module"; // products/fia');
    write(root, 'src/products/fia/module.ts', 'import { Shell } from "../../template/Shell";');
    expect(checkBoundaries({ root }).violations).toEqual([]);
  });

  it('refuses template -> product, product -> product and anything -> demo', () => {
    const root = tempDir();
    write(root, 'src/template/Flow.tsx', 'import { fia } from "../products/fia/module";');
    write(root, 'src/products/fia/module.ts', 'import { myga } from "../myga/module";');
    write(root, 'src/products/myga/module.ts', 'export const myga = 1;');
    write(root, 'src/Calculator.tsx', 'import { sample } from "./demo/fixtures";');
    write(root, 'src/demo/fixtures.ts', 'export const sample = 1;');
    const { violations } = checkBoundaries({ root });
    expect(violations).toHaveLength(3);
    expect(violations.join('\n')).toMatch(/template -> product:fia/);
    expect(violations.join('\n')).toMatch(/product:fia -> product:myga/);
    expect(violations.join('\n')).toMatch(/root -> demo/);
  });
});

describe('removal', () => {
  it('drops only the lines naming the product', () => {
    const registry = 'import { a } from "./fia/module";\nimport { b } from "./myga/module";\nconst m = [\n  a, // products/fia\n  b, // products/myga\n];';
    const after = registryWithout(registry, 'fia');
    expect(after).not.toMatch(/fia/);
    expect(after).toMatch(/myga\/module/);
    expect(after.split('\n')).toHaveLength(4);
  });
});

describe('sync', () => {
  it('flags a workflow pinned to another SDK version and fixes it', () => {
    const root = tempDir();
    write(root, '.github/workflows/release.yml', `jobs:\n  release:\n    uses: ${PUBLISH_WORKFLOW}@v0.0.1\n`);
    write(root, 'AGENTS.md', `# Repo\n\n${sharedAgentsBlock()}\n`);
    expect(checkSync({ root }).problems.join('\n')).toMatch(/@v0.0.1/);
    checkSync({ root, fix: true });
    expect(readFileSync(join(root, '.github/workflows/release.yml'), 'utf8')).toContain(`${PUBLISH_WORKFLOW}@v${SDK_VERSION}`);
    expect(checkSync({ root, strict: true }).problems).toEqual([]);
  });

  it('keeps the screenshots workflow on the installed SDK version too', () => {
    const root = tempDir();
    const screenshots = 'Illustration-innovators/client-sdk/.github/workflows/pr-screenshots.yml';
    write(root, '.github/workflows/release.yml', `jobs:\n  release:\n    uses: ${PUBLISH_WORKFLOW}@v${SDK_VERSION}\n`);
    write(root, '.github/workflows/ci.yml', `jobs:\n  screenshots:\n    uses: ${screenshots}@v0.0.1\n`);
    write(root, 'AGENTS.md', `# Repo\n\n${sharedAgentsBlock()}\n`);
    expect(checkSync({ root }).problems.join('\n')).toMatch(/pr-screenshots.yml is @v0.0.1/);
    checkSync({ root, fix: true });
    expect(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).toContain(`${screenshots}@v${SDK_VERSION}`);
    expect(checkSync({ root, strict: true }).problems).toEqual([]);
  });

  it('adds or refreshes the shared AGENTS.md section', () => {
    const root = tempDir();
    write(root, 'AGENTS.md', `# Repo\n\nLocal rules.\n\n${SHARED_START}\nold text\n${SHARED_END}\n\nMore local rules.\n`);
    expect(checkSync({ root }).problems.join('\n')).toMatch(/does not match/);
    checkSync({ root, fix: true });
    const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(text).toContain('Local rules.');
    expect(text).toContain('More local rules.');
    expect(text).not.toContain('old text');
    expect(checkSync({ root }).problems).toEqual([]);
  });
});

describe('drift normalization', () => {
  it('treats the two contract import locations as the same', () => {
    expect(normalizeRuntimeSource('import type { X } from "../../packages/calculator-contract/src/index";'))
      .toBe(normalizeRuntimeSource('import type { X } from "../contract/index";'));
  });
});

describe('config', () => {
  it('rejects unknown keys and a second React plugin', () => {
    expect(() => validateConfig({ plugin: [] })).toThrow(/unsupported keys/);
    expect(() => validateConfig({ plugins: [{ name: 'vite:react-babel' }] })).toThrow(/plugin-react/);
    expect(() => validateConfig({ buildQuery: { from: '../x.mjs', export: 'q' } })).toThrow(/buildQuery/);
    expect(validateConfig({ plugins: [], css: {}, buildQuery: { from: 'widget/query.mjs', export: 'buildQuery' } })).toBeTruthy();
  });
});
