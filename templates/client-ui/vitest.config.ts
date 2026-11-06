import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import illustrata from "./illustrata.config";

export default defineConfig({
  css: illustrata.css,
  plugins: [...(illustrata.plugins ?? []), react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    css: true,
  },
});
