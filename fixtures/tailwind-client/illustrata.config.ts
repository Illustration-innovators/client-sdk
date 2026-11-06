import tailwindcss from "@tailwindcss/vite";
import { shadowPropertyFallback } from "../../src/postcss/shadow-property-fallback";
import { defineIllustrataConfig } from "../../src/config";

// A client repository imports these from "@illustrata/client-sdk/postcss" and
// "@illustrata/client-sdk/config"; the fixture uses relative paths so tests
// run against the source.
export default defineIllustrataConfig({
  plugins: [tailwindcss()],
  css: { postcss: { plugins: [shadowPropertyFallback()] } },
});
