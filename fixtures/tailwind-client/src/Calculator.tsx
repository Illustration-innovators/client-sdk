import type { IllustrataCalculatorRuntime } from "../../../src/contract/index";
import css from "./styles.css?inline";

export const CALCULATOR_CSS: string = css;

export default function Calculator({ runtime }: { runtime: IllustrataCalculatorRuntime }) {
  return (
    <section className="fixture-root rounded-lg border p-4">
      <h1 className="bg-fixture-accent text-white">Fixture</h1>
      <ul>
        {runtime.products.map((product) => (
          <li key={product.slug} data-product={product.slug}>{product.name}</li>
        ))}
      </ul>
    </section>
  );
}
