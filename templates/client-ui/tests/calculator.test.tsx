import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CalculatorProduct, IllustrataCalculatorRuntime } from "@illustrata/client-sdk/contract";
import Calculator, { CALCULATOR_CSS, resolveEntries } from "../src/Calculator";
import { PRODUCT_MODULES } from "../src/products/registry";
import products from "./fixtures/products.json";

const runtime = (list: unknown[]): IllustrataCalculatorRuntime => ({
  products: list as CalculatorProduct[],
  calculate: async () => ({}) as never,
  reportError: () => {},
});

describe("Calculator", () => {
  it("renders every linked product, as a screen or as a configuration error", () => {
    // Holds with any set of product modules, including none (removal check).
    const html = renderToStaticMarkup(<Calculator runtime={runtime(products)} />);
    expect(html).toContain("Demo Fixed Indexed Annuity");
  });

  it("shows a configuration error instead of guessing", () => {
    const spia = { ...products[0], slug: "spia", name: "Income Annuity", variants: [{ ...products[0]!.variants[0], kind: "spia" }] };
    const [entry] = resolveEntries(runtime([spia]), PRODUCT_MODULES);
    expect(entry!.module).toBeNull();
    expect(renderToStaticMarkup(<Calculator runtime={runtime([spia])} />)).toContain("not configured correctly");
  });

  it("ships its styles in CALCULATOR_CSS", () => {
    expect(CALCULATOR_CSS).toContain("--illustrata-accent");
  });
});
