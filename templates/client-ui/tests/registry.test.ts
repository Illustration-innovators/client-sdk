import { describe, expect, it } from "vitest";
import { VARIANT_KINDS } from "@illustrata/client-sdk/products";
import { PRODUCT_MODULES } from "../src/products/registry";

describe("product registry", () => {
  it("has unique keys and only known variant kinds", () => {
    const keys = PRODUCT_MODULES.map((module) => module.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const module of PRODUCT_MODULES) {
      for (const kind of module.supportedKinds) expect(VARIANT_KINDS).toContain(kind);
    }
  });
});
