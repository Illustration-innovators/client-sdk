import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import type { CalculatorManifest, CalculatorProduct, IllustrataCalculatorRuntime } from "../contract/index.js";
import { createLiveRuntime, parsePreviewProducts, type PreviewConnection } from "./live-runtime.js";

const SESSION_KEY = "illustrata-preview-staging-key";

/**
 * Local development only. Wraps the UI with a panel that connects the preview
 * to staging through the dev server bridge. Without a key the preview runtime
 * answers; with one, products are calculated on staging.
 *
 * Derived from the calculators repository (tooling/development/StagingPreview.tsx).
 * Never import this from `src/index.ts` or anything that ships in a release.
 */
export function StagingPreview({ manifest, createPreviewRuntime, render }: {
  manifest: CalculatorManifest;
  createPreviewRuntime(getProducts?: () => CalculatorProduct[] | undefined): IllustrataCalculatorRuntime;
  /** Renders the UI with the runtime to use. */
  render(runtime: IllustrataCalculatorRuntime): ReactNode;
}) {
  const [key, setKey] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) ?? ""; } catch { return ""; }
  });
  const [serverConfigured, setServerConfigured] = useState(false);
  const [useServerKey, setUseServerKey] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/__illustrata-preview-config").then((response) => response.ok ? response.json() : {}).then((config) => {
      if (active) setServerConfigured((config as { stagingKeyConfigured?: unknown }).stagingKeyConfigured === true);
    }).catch(() => { /* Manual key entry remains available. */ });
    return () => { active = false; };
  }, []);
  const connected = !!key || (serverConfigured && useServerKey);
  const [products, setProducts] = useState<CalculatorProduct[]>();
  const [error, setError] = useState("");
  const productsRef = useRef(products);
  productsRef.current = products;
  const preview = useMemo(() => createPreviewRuntime(() => productsRef.current), [createPreviewRuntime]);
  const connectionRef = useRef<PreviewConnection | null>(null);
  connectionRef.current = connected ? { apiKey: key, environment: "staging" } : null;
  const runtime = useMemo(
    () => createLiveRuntime(manifest, () => connectionRef.current, preview, () => productsRef.current),
    // Recreate on connection or product changes so the UI clears old results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest, preview, key, products, connected],
  );

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("apiKey") ?? "").trim();
    if (!value) return;
    try { sessionStorage.setItem(SESSION_KEY, value); } catch { /* Session storage is optional. */ }
    setKey(value);
    event.currentTarget.reset();
  }
  function disconnect() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Session storage is optional. */ }
    setKey("");
    setUseServerKey(false);
  }

  return <>
    <section className="illustrata-preview-controls" aria-label="Local staging connection">
      <div>
        <strong>{connected ? "Connected to staging" : "Local preview with sample data"}</strong>
        <p>{connected ? "Calculations run on staging. Failed requests do not fall back to samples." : "Paste a staging test key to see real staging results."}</p>
        <p>To keep the key between sessions, add <code>ILLUSTRATA_STAGING_API_KEY</code> to <code>.env.local</code> and restart <code>npm run dev</code>. That file is git-ignored and the key stays on the dev server.</p>
        {serverConfigured && <p>A staging key is available from your local <code>.env.local</code>.</p>}
      </div>
      {connected ? <button type="button" onClick={disconnect}>Disconnect staging</button> :
        <form onSubmit={connect}>
          <label htmlFor="illustrata-staging-api-key">Staging test key</label>
          <input id="illustrata-staging-api-key" name="apiKey" type="password" autoComplete="off" required placeholder="Paste your staging test key" />
          <button type="submit">Connect to staging</button>
        </form>}
      <details>
        <summary>Products used by the preview</summary>
        <p>Match slugs, variant kinds and Spark codes to the staging products in the admin portal. The key does not look up product configuration.</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          try { setProducts(parsePreviewProducts(String(new FormData(event.currentTarget).get("products")))); setError(""); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid products."); }
        }}>
          <label htmlFor="illustrata-preview-products">Products and variants (JSON)</label>
          <textarea id="illustrata-preview-products" name="products" rows={12} defaultValue={JSON.stringify(products ?? preview.products, null, 2)} />
          <button type="submit">Apply products</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </details>
    </section>
    {render(runtime)}
  </>;
}

/** Page-level styles for the preview panel. Inject on the preview page only. */
export const PREVIEW_CONTROLS_CSS = `
.illustrata-preview-controls { position:relative; background:#eef3fa; color:#17243a; border-bottom:1px solid #bdc7d5; padding:16px 24px; font:14px/1.5 system-ui,sans-serif; }
.illustrata-preview-controls p { margin:4px 0; }
.illustrata-preview-controls form { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:12px; }
.illustrata-preview-controls input,.illustrata-preview-controls textarea { font:inherit; border:1px solid #8a9bb2; border-radius:6px; padding:9px 12px; background:white; color:#17243a; }
.illustrata-preview-controls input { width:min(420px,100%); }
.illustrata-preview-controls textarea { width:100%; font-family:monospace; }
.illustrata-preview-controls button { font:inherit; background:#174f91; color:white; padding:9px 16px; border:1px solid #174f91; border-radius:6px; cursor:pointer; }
.illustrata-preview-controls details { margin-top:10px; }
.illustrata-preview-controls summary { cursor:pointer; }
.illustrata-preview-controls :focus-visible { outline:3px solid #2467bd; outline-offset:3px; }
@media(max-width:600px) { .illustrata-preview-controls { padding:12px; } .illustrata-preview-controls form { align-items:stretch; flex-direction:column; } }
`;

export type { ComponentType };
