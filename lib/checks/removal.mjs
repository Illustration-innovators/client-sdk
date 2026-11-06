// Product-removal check: deletes one product module and proves the rest of
// the UI still typechecks, passes its tests and builds without it. This is the
// guarantee that no product becomes load-bearing for the template.
//
// It is destructive by design. It refuses to run when the products folder has
// uncommitted changes, and restores the folder from git when it finishes.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DEFAULT_REMOVAL_COMMANDS = ['npm run check-types', 'npx illustrata-check boundaries', 'npm test', 'npx illustrata-release build --out .illustrata-removal-check --no-version-stamp'];

/** Lines of the registry that mention the product folder. */
export function registryWithout(registryText, product) {
  const marker = new RegExp(`(\\./${product}/|products/${product}\\b)`);
  return registryText.split('\n').filter(line => !marker.test(line)).join('\n');
}

export function checkRemoval({ root = process.cwd(), product, productsDir = 'src/products', registry = 'src/products/registry.ts', commands = DEFAULT_REMOVAL_COMMANDS, allowDirty = false, log = console.log }) {
  if (!product || !/^[a-z][a-z0-9-]*$/.test(product)) throw new Error('Name the product folder to remove, for example: illustrata-check removal fia');
  const rootDir = resolve(root);
  const productDir = join(rootDir, productsDir, product);
  if (!existsSync(productDir)) throw new Error(`No product module at ${productsDir}/${product}`);
  const run = (command, options = {}) => execSync(command, { cwd: rootDir, stdio: 'inherit', ...options });
  const status = execSync(`git status --porcelain -- ${JSON.stringify(productsDir)}`, { cwd: rootDir }).toString().trim();
  if (status && !allowDirty) throw new Error(`${productsDir} has uncommitted changes. Commit or stash them first: this check deletes files and restores them from git.`);

  const registryPath = join(rootDir, registry);
  const before = readFileSync(registryPath, 'utf8');
  const after = registryWithout(before, product);
  if (after === before) throw new Error(`${registry} has no lines referencing "${product}". Keep one module per line with a "// products/${product}" marker.`);

  let failed = null;
  try {
    log(`Removing ${productsDir}/${product} and its registry lines...`);
    rmSync(productDir, { recursive: true, force: true });
    writeFileSync(registryPath, after);
    for (const command of commands) {
      log(`\n> ${command}`);
      failed = command;
      run(command);
    }
    failed = null;
  } catch {
    // The failing command printed its own output.
  } finally {
    if (!status) {
      run(`git checkout -- ${JSON.stringify(productsDir)}`, { stdio: 'ignore' });
      run(`git clean -fdq -- ${JSON.stringify(productsDir)}`, { stdio: 'ignore' });
      rmSync(join(rootDir, '.illustrata-removal-check'), { recursive: true, force: true });
      log(`Restored ${productsDir} from git.`);
    } else {
      log(`Working tree was dirty; not restoring. Use git to recover ${productsDir}.`);
    }
  }
  if (failed) throw new Error(`Removal check failed: "${failed}" did not pass without ${productsDir}/${product}. Something outside that folder depends on it.`);
  log(`Removal check passed: the UI works without ${productsDir}/${product}.`);
}
