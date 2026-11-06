import { useState, type FormEvent } from "react";
import type { ProductModule, ProductScreenProps } from "../../template/module";

/**
 * Example product module. Replace it with the client's first real product,
 * or copy it per product (docs/ADDING_A_PRODUCT.md). It collects a premium,
 * calls the product's main endpoint through the runtime and shows the JSON
 * the portal's output mappings return.
 */
function ExampleScreen({ product, runtime }: ProductScreenProps) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [premium, setPremium] = useState("100000");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Keys here must match the product's input mappings in the portal.
      setResult(await runtime.calculate(product.slug, { productCode: variant?.sparkProductCode, premium: Number(premium) }));
    } catch (cause) {
      runtime.reportError(cause, { product: product.slug });
      setError("The illustration could not be calculated. Try again, or contact support.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line p-6">
      <h2 className="font-heading text-lg font-semibold">{product.name}</h2>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Product option
          <select className="rounded-md border border-line p-2" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
            {product.variants.map((item) => (
              <option key={item.id} value={item.id}>{item.displayName}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Premium
          <input className="rounded-md border border-line p-2" inputMode="decimal" value={premium} onChange={(event) => setPremium(event.target.value)} />
        </label>
        <button type="submit" disabled={busy} className="rounded-md bg-button px-4 py-2 font-medium text-on-button hover:bg-hover hover:text-on-hover disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
          {busy ? "Calculating…" : "Calculate"}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {result !== null && (
        <pre className="overflow-x-auto rounded-md bg-secondary p-4 text-xs text-on-secondary">{JSON.stringify(result, null, 2)}</pre>
      )}
    </section>
  );
}

export const exampleModule: ProductModule = {
  key: "example",
  label: "Example annuity",
  supportedKinds: ["myga", "fia-accum", "fia-bonus", "fia-glwb"],
  Screen: ExampleScreen,
};
