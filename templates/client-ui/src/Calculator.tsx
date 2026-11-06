import { useMemo, useState } from "react";
import type { IllustrataCalculatorRuntime } from "@illustrata/client-sdk/contract";
import { parseProduct, resolveProductModule, type PortalProduct } from "@illustrata/client-sdk/products";
import manifest from "../calculator.manifest.json";
import { PRODUCT_MODULES } from "./products/registry";
import { ConfigError } from "./template/ConfigError";
import type { ProductModule } from "./template/module";
import { Shell } from "./template/Shell";
import templateCss from "./template/styles/template.css?inline";

/** The stylesheet the host injects into the Shadow DOM: template CSS, then each module's. */
export const CALCULATOR_CSS: string = [templateCss, ...PRODUCT_MODULES.map((module) => module.css ?? "")].join("\n");

export interface CalculatorProps {
  /** Supplied by the Illustrata runtime (`@illustrata/client-sdk/contract`). */
  runtime: IllustrataCalculatorRuntime;
  /** The shadow host element. */
  host?: Element;
  /** Registered modules. Overridden only by tests. */
  modules?: readonly ProductModule[];
}

export interface ProductEntry {
  slug: string;
  name: string;
  product: PortalProduct | null;
  module: ProductModule | null;
  problem: string | null;
}

/** One entry per portal product: its module, or the reason it has none. */
export function resolveEntries(runtime: IllustrataCalculatorRuntime, modules: readonly ProductModule[]): ProductEntry[] {
  return runtime.products.map((raw) => {
    const parsed = parseProduct(raw);
    if (!parsed.ok) return { slug: parsed.slug, name: parsed.name, product: null, module: null, problem: parsed.reason };
    const resolution = resolveProductModule(parsed.product, modules);
    if (!resolution.ok) return { slug: raw.slug, name: raw.name, product: parsed.product, module: null, problem: resolution.reason };
    return { slug: raw.slug, name: raw.name, product: parsed.product, module: resolution.module, problem: null };
  });
}

/** Root component the host mounts. */
export default function Calculator({ runtime, modules = PRODUCT_MODULES }: CalculatorProps) {
  const entries = useMemo(() => resolveEntries(runtime, modules), [runtime, modules]);
  const usable = entries.filter((entry) => entry.module && entry.product);
  const [selected, setSelected] = useState(usable[0]?.slug ?? "");
  const active = usable.find((entry) => entry.slug === selected) ?? usable[0];

  return (
    <Shell title={manifest.displayName}>
      {entries.length === 0 && (
        <p role="status">No products are linked to this tool yet. Link them in the Illustrata portal.</p>
      )}
      {entries
        .filter((entry) => entry.problem)
        .map((entry) => (
          <ConfigError key={entry.slug} name={entry.name} problem={entry.problem!} />
        ))}
      {usable.length > 1 && (
        <nav aria-label="Products" className="flex flex-wrap gap-2">
          {usable.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              aria-pressed={entry.slug === active?.slug}
              onClick={() => setSelected(entry.slug)}
              className="rounded-md border border-line px-3 py-1.5 text-sm aria-pressed:bg-accent aria-pressed:text-on-accent"
            >
              {entry.name}
            </button>
          ))}
        </nav>
      )}
      {active && active.module && active.product && (
        <active.module.Screen key={active.slug} product={active.product} runtime={runtime} />
      )}
    </Shell>
  );
}
