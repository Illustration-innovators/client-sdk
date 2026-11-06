import type { ProductModule } from "../template/module";
import { exampleModule } from "./example/module";

/**
 * The one place product modules are listed. Nothing else imports a product
 * folder (`illustrata-check boundaries` enforces this).
 *
 * Keep one module per line, each ending in `// products/<folder>`, and its
 * import on its own line: `illustrata-check removal <folder>` deletes those
 * lines and proves the template still works without the product.
 */
const modules: readonly ProductModule[] = [
  exampleModule, // products/example
];

const keys = new Set<string>();
for (const module of modules) {
  if (keys.has(module.key)) throw new Error(`Duplicate product module key "${module.key}"`);
  keys.add(module.key);
}

export const PRODUCT_MODULES: readonly ProductModule[] = Object.freeze([...modules]);
