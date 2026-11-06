import tailwindcss from "@tailwindcss/vite";
import { defineIllustrataConfig } from "@illustrata/client-sdk/config";
import { shadowPropertyFallback } from "@illustrata/client-sdk/postcss";

/**
 * Build settings that vary by repository. The SDK's release builder reads this
 * file; vite.lib.config.ts, vite.preview.config.ts and vitest.config.ts use it
 * too, so styles build the same everywhere. Do not add @vitejs/plugin-react
 * here: the release builder adds it, and each Vite config adds its own.
 */
export default defineIllustrataConfig({
  plugins: [tailwindcss()],
  css: { postcss: { plugins: [shadowPropertyFallback()] } },
  checks: {
    smoke: { products: "tests/fixtures/products.json" },
  },
});
