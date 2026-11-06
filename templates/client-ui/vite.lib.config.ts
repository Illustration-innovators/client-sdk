import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import illustrata from "./illustrata.config";

/**
 * Library build, for local checks only. Releases are built by
 * `npx illustrata-release build`, which compiles React and the runtime into
 * one self-contained bundle using the same illustrata.config.ts.
 */
export default defineConfig({
  css: illustrata.css,
  plugins: [...(illustrata.plugins ?? []), react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
    },
  },
});
