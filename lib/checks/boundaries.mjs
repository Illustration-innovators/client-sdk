// Import-boundary check for client UI repositories.
//
// Zones (paths relative to the source directory, default `src/`):
//   contract        contract/**            may import: contract
//   template        template/**            may import: template, contract
//   products-root   products/*.ts(x)       may import: products-root, template, contract
//   registry        products/registry.ts   additionally: any product
//   product:<x>     products/<x>/**        may import: itself, products-root (not registry), template, contract
//   root            *.ts(x)                may import: root, registry, products-root, template, contract, the manifest
//   demo            demo/**                may import anything; nothing outside demo imports demo
//
// The template never imports a product, no product imports another product,
// and only the registry names product folders. These rules keep any product
// removable without touching the rest.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IMPORT_RE = /(?:^|[\n;])\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXTENSIONS.has(full.slice(full.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

function inDir(rel, dir) {
  return rel === dir || rel.startsWith(`${dir}/`);
}

export function zoneOf(file, srcDir, manifestPath) {
  if (file === manifestPath) return 'manifest';
  const rel = relative(srcDir, file).split(sep).join('/');
  if (rel.startsWith('..')) return 'outside';
  if (inDir(rel, 'contract')) return 'contract';
  if (inDir(rel, 'template')) return 'template';
  if (inDir(rel, 'demo')) return 'demo';
  if (inDir(rel, 'products')) {
    const parts = rel.split('/');
    if (parts.length === 2) return parts[1].replace(/\.[^.]+$/, '') === 'registry' ? 'registry' : 'products-root';
    return `product:${parts[1]}`;
  }
  return 'root';
}

export function isAllowed(from, to) {
  if (from === 'demo') return true;
  if (to === 'demo' || to === 'outside') return false;
  if (to === 'manifest') return from === 'root';
  if (from.startsWith('product:')) return to === from || to === 'products-root' || to === 'template' || to === 'contract';
  switch (from) {
    case 'contract': return to === 'contract';
    case 'template': return to === 'template' || to === 'contract';
    case 'products-root': return to === 'products-root' || to === 'template' || to === 'contract';
    case 'registry': return to === 'registry' || to === 'products-root' || to === 'template' || to === 'contract' || to.startsWith('product:');
    case 'root': return to === 'root' || to === 'registry' || to === 'products-root' || to === 'template' || to === 'contract';
    default: return false;
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/** Returns `{ files, imports, violations }`; violations are human-readable lines. */
export function checkBoundaries({ root = process.cwd(), srcDir = 'src' } = {}) {
  const rootDir = resolve(root);
  const src = resolve(rootDir, srcDir);
  if (!existsSync(src)) throw new Error(`No source directory at ${src}`);
  const manifestPath = join(rootDir, 'calculator.manifest.json');
  const files = walk(src);
  const violations = [];
  let imports = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const from = zoneOf(file, src, manifestPath);
    for (const re of [IMPORT_RE, DYNAMIC_RE]) {
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(text))) {
        const specifier = match[1];
        if (!specifier.startsWith('.')) continue;
        imports += 1;
        const to = zoneOf(resolve(dirname(file), specifier.split('?')[0]), src, manifestPath);
        if (!isAllowed(from, to)) violations.push(`${relative(rootDir, file)}:${lineOf(text, match.index)}  ${from} -> ${to}  (${specifier})`);
      }
    }
  }
  return { files: files.length, imports, violations };
}
