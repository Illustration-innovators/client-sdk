import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import illustrata from "./illustrata.config";

/**
 * Local preview only: `npm run dev`. Mounts the UI in a Shadow DOM the way the
 * Illustrata host does, with the demo products in src/demo/fixtures.ts.
 */
export default defineConfig({
  root: fileURLToPath(new URL("./src/demo", import.meta.url)),
  css: illustrata.css,
  plugins: [...(illustrata.plugins ?? []), react()],
  server: { port: 5174 },
});
