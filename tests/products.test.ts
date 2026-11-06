import { describe, expect, it } from "vitest";
import { parseProduct, resolveProductModule, type ResolvableModule } from "../src/products/index";
import type { CalculatorProduct } from "../src/contract/index";

function product(slug: string, kinds: string[], profile?: string): CalculatorProduct {
  return {
    slug,
    name: `Product ${slug}`,
    allowedStates: null,
    variants: kinds.map((kind, index) => ({ id: `${slug}-${index}`, displayName: kind, sparkProductCode: `C${index}`, kind, displayOrder: kinds.length - index, allowedStates: null })),
    ...(profile ? { templateConfig: { settings: { profile } } } : {}),
  } as CalculatorProduct;
}

function parsed(raw: CalculatorProduct) {
  const result = parseProduct(raw);
  if (!result.ok) throw new Error(result.reason);
  return result.product;
}

const fia: ResolvableModule = { key: "fia", supportedKinds: ["fia-accum", "fia-bonus"] };
const myga: ResolvableModule = { key: "myga", supportedKinds: ["myga"] };
const myga2: ResolvableModule = { key: "myga-2", supportedKinds: ["myga"] };

describe("parseProduct", () => {
  it("fails closed on an unknown kind or no variants", () => {
    expect(parseProduct(product("x", ["spaceship"])).ok).toBe(false);
    expect(parseProduct(product("x", [])).ok).toBe(false);
  });
  it("sorts variants and reads the profile", () => {
    const result = parsed(product("x", ["fia-bonus", "fia-accum"], "fia"));
    expect(result.variants.map((v) => v.kind)).toEqual(["fia-accum", "fia-bonus"]);
    expect(result.profile).toBe("fia");
  });
});

describe("resolveProductModule", () => {
  it("picks the one module that supports every kind", () => {
    const resolution = resolveProductModule(parsed(product("x", ["fia-accum", "fia-bonus"])), [fia, myga]);
    expect(resolution.ok && resolution.module.key).toBe("fia");
  });
  it("has no default and refuses ambiguity without a profile", () => {
    expect(resolveProductModule(parsed(product("x", ["spia"])), [fia, myga]).ok).toBe(false);
    expect(resolveProductModule(parsed(product("x", ["myga"])), [myga, myga2]).ok).toBe(false);
    const chosen = resolveProductModule(parsed(product("x", ["myga"], "myga-2")), [myga, myga2]);
    expect(chosen.ok && chosen.module.key).toBe("myga-2");
  });
});
