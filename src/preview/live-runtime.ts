import type { CalculatorManifest, CalculatorProduct, IllustrataCalculatorRuntime } from "../contract/index.js";

/**
 * Local development only. A runtime whose `calculate` goes through the dev
 * server bridge (`illustrataDevelopmentBridge`) to staging, falling back to a
 * preview runtime when no staging key is connected.
 *
 * Derived from the calculators repository (tooling/development/runtime.ts).
 */
export interface PreviewConnection {
  apiKey: string;
  environment: "staging" | "local";
}

export function parsePreviewProducts(value: string): CalculatorProduct[] {
  const products: unknown = JSON.parse(value);
  if (!Array.isArray(products) || products.length === 0) throw new Error("Provide at least one product.");
  const slugs = new Set<string>();
  const ids = new Set<string>();
  for (const product of products) {
    if (!product || typeof product.slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(product.slug) ||
        typeof product.name !== "string" || !product.name.trim() || slugs.has(product.slug) ||
        !(product.allowedStates === null || (Array.isArray(product.allowedStates) && product.allowedStates.every((s: unknown) => typeof s === "string" && /^[A-Z]{2}$/.test(s)))) ||
        !Array.isArray(product.variants)) throw new Error("Products need unique slugs, names, allowedStates (null or state codes), and variants.");
    slugs.add(product.slug);
    for (const variant of product.variants) {
      if (!variant || typeof variant.id !== "string" || !variant.id || ids.has(variant.id) ||
          typeof variant.kind !== "string" || !variant.kind || typeof variant.displayName !== "string" ||
          typeof variant.sparkProductCode !== "string" || !variant.sparkProductCode.trim()) {
        throw new Error("Variants need unique IDs, kind, displayName and the portal's sparkProductCode.");
      }
      ids.add(variant.id);
    }
  }
  return products as CalculatorProduct[];
}

export function createLiveRuntime(
  manifest: CalculatorManifest,
  getConnection: () => PreviewConnection | null,
  preview?: IllustrataCalculatorRuntime,
  getProducts?: () => CalculatorProduct[] | undefined,
  transport: typeof fetch = fetch,
): IllustrataCalculatorRuntime {
  const integration = manifest.integration;
  const fallback = integration.type === "illustrata-products"
    ? integration.productContractKeys.map((slug) => ({ slug, name: slug, allowedStates: null, variants: [] })) : [];
  return {
    get products() { return getProducts?.() ?? preview?.products ?? fallback; },
    workspace: preview?.workspace?.preview ? preview.workspace : undefined,
    launchContext: preview?.launchContext ?? null,
    async calculate<T>(slug: string, inputs: Record<string, unknown>, options?: Parameters<IllustrataCalculatorRuntime["calculate"]>[2]): Promise<T> {
      const connection = getConnection();
      if (!connection) {
        if (preview) return preview.calculate<T>(slug, inputs, options);
        throw new Error("Connect an Illustrata staging test key before calculating.");
      }
      const query = new URLSearchParams();
      if (options?.endpoint) query.set("endpoint", options.endpoint);
      if (options?.format) query.set("format", options.format);
      const response = await transport(`/__illustrata/api/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-illustrata-test-key": connection.apiKey, "x-illustrata-environment": connection.environment },
        body: JSON.stringify(inputs),
        signal: options?.signal,
      });
      if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
        throw new Error(`Illustrata returned a non-JSON response (${response.status}). Choose JSON or both in the product configuration.`);
      }
      const body = await response.json();
      if (!response.ok) {
        throw Object.assign(new Error(body?.error?.message || body?.message || (typeof body?.error === "string" ? body.error : `Illustrata returned ${response.status}.`)), { status: response.status });
      }
      return body as T;
    },
    reportError() { /* Do not log request data or credentials from development runs. */ },
  };
}
