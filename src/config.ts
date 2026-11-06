import type { CSSOptions, PluginOption } from "vite";

/**
 * Per-repository settings, in `illustrata.config.ts` at the repository root.
 * The release builder, the checks and (by convention) the repository's own
 * Vite configs all read this one file, so a style or build setting is written
 * once.
 */
export interface IllustrataConfig {
  /**
   * Vite plugins the UI needs to compile, such as `tailwindcss()`. Do not add
   * `@vitejs/plugin-react`; the builder adds it.
   */
  plugins?: PluginOption[];
  /** Vite CSS options, such as PostCSS plugins. */
  css?: CSSOptions;
  /** Module exporting `Calculator` and `CALCULATOR_CSS`. Default `src/index.ts`. */
  entry?: string;
  /**
   * Optional product query builder passed to the runtime: a module relative
   * to the repository root and the name of its export.
   */
  buildQuery?: { from: string; export: string };
  checks?: IllustrataChecksConfig;
}

export interface IllustrataChecksConfig {
  /** Import-boundary check. `false` turns it off. */
  boundaries?: false | { srcDir?: string };
  /** Product-removal check. */
  removal?: {
    /** Folder holding one subfolder per product module. Default `src/products`. */
    productsDir?: string;
    /** The registry file listing modules one per line. Default `src/products/registry.ts`. */
    registry?: string;
    /** Commands that must pass with the product removed. */
    commands?: string[];
  };
  /** Release smoke test. */
  smoke?: {
    /** JSON file of host-shaped products to mount the release with. */
    products?: string;
  };
}

/** Identity helper that gives `illustrata.config.ts` type checking. */
export function defineIllustrataConfig(config: IllustrataConfig): IllustrataConfig {
  return config;
}
