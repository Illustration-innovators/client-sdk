import { mountPreview } from "@illustrata/client-sdk/preview";
import type { CalculatorProduct, IllustrataCalculatorRuntime } from "@illustrata/client-sdk/contract";
import manifest from "../../calculator.manifest.json";
import products from "../../tests/fixtures/products.json";
import Calculator, { CALCULATOR_CSS } from "../Calculator";

/** Canned runtime for the local preview. Nothing here ships in a release. */
const runtime: IllustrataCalculatorRuntime = {
  products: products as CalculatorProduct[],
  async calculate<T>(productSlug: string, inputs: Record<string, unknown>) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { preview: true, productSlug, inputs, values: { accountValueYear10: 154_000 } } as T;
  },
  reportError(error) {
    console.error("Preview error", error);
  },
};

mountPreview({
  target: document.getElementById("preview")!,
  css: CALCULATOR_CSS,
  embedType: manifest.embedType,
  render: (host) => <Calculator runtime={runtime} host={host} />,
});
