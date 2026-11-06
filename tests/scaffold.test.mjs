import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scaffoldClientUi } from '../lib/scaffold.mjs';
import { checkSync, SHARED_START } from '../lib/checks/sync.mjs';
import { SDK_VERSION } from '../lib/sdk.mjs';
import { tempDir } from './support.mjs';

describe('create-client-ui', () => {
  it('writes a complete repository pinned to this SDK version', () => {
    const directory = join(tempDir(), 'acme-ui');
    const result = scaffoldClientUi({ clientKey: 'acme', directory, name: 'Acme Life' });
    expect(result.embedType).toBe('acme--illustration');
    for (const file of ['.gitignore', '.nvmrc', '.github/workflows/ci.yml', '.github/workflows/release.yml', '.github/CODEOWNERS', 'AGENTS.md', 'calculator.manifest.json', 'illustrata.config.ts', 'src/index.ts', 'src/products/registry.ts', 'tests/fixtures/products.json', 'design/handoff/README.md']) {
      expect(result.files).toContain(file);
    }
    expect(result.files.some(file => file.includes('dot-'))).toBe(false);
    const read = (file) => readFileSync(join(directory, file), 'utf8');
    const manifest = JSON.parse(read('calculator.manifest.json'));
    expect(manifest).toMatchObject({ embedType: 'acme--illustration', clientKey: 'acme', calculatorKey: 'illustration', displayName: 'Acme Life Illustration' });
    expect(manifest.integration.endpointRoles).toEqual(['primary']);
    expect(JSON.parse(read('package.json')).devDependencies['@illustrata/client-sdk']).toBe(SDK_VERSION);
    expect(read('.github/workflows/release.yml')).toContain(`publish-release.yml@v${SDK_VERSION}`);
    expect(read('.github/workflows/ci.yml')).toContain(`pr-screenshots.yml@v${SDK_VERSION}`);
    expect(read('.github/CODEOWNERS')).toContain('/calculator.manifest.json   @benrutt99 @ianmartens23');
    expect(read('AGENTS.md')).toContain(SHARED_START);
    expect(checkSync({ root: directory, strict: true }).problems).toEqual([]);
  });

  it('takes a tool name and owners', () => {
    const directory = join(tempDir(), 'out');
    scaffoldClientUi({ clientKey: 'acme', directory, tool: 'sales-demo', owners: '@someone @org/team' });
    expect(JSON.parse(readFileSync(join(directory, 'calculator.manifest.json'), 'utf8')).embedType).toBe('acme--sales-demo');
    expect(readFileSync(join(directory, '.github/CODEOWNERS'), 'utf8')).toContain('@someone @org/team');
  });

  it('refuses bad names, bad owners and a non-empty directory', () => {
    const directory = join(tempDir(), 'x');
    for (const clientKey of ['Acme', 'acme--ui', '1acme', 'acme_life', '', 'a'.repeat(41)]) {
      expect(() => scaffoldClientUi({ clientKey, directory })).toThrow(/client key/);
    }
    expect(() => scaffoldClientUi({ clientKey: 'acme', directory, tool: 'Sales' })).toThrow(/--tool/);
    expect(() => scaffoldClientUi({ clientKey: 'acme', directory, owners: 'not a handle' })).toThrow(/--owners/);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'keep.txt'), 'x');
    expect(() => scaffoldClientUi({ clientKey: 'acme', directory })).toThrow(/not empty/);
  });
});
