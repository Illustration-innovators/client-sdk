import type { Plugin } from "postcss";

/**
 * Shadow DOM fallback for Tailwind v4's `@property` defaults.
 *
 * Tailwind v4 declares the defaults its utilities rely on (`--tw-border-style:
 * solid`, the shadow and ring stacks, `--tw-outline-style`, ...) with
 * `@property` rules. Chrome registers custom properties only from
 * document-level stylesheets, so inside a shadow root those rules are ignored
 * and every `var(--tw-*)` resolves to nothing: borders render with width 0,
 * shadows and rings vanish. Tailwind's own fallback block targets only old
 * Safari and Firefox.
 *
 * This plugin runs after Tailwind and re-declares each `@property` initial
 * value on every element of the shadow tree, inside `@layer base`, so
 * utilities (a higher layer) still override them. The `@property` rules are
 * left in place; they are harmless where they do work.
 *
 * Use it in `illustrata.config.ts`:
 *   css: { postcss: { plugins: [shadowPropertyFallback()] } }
 */
export function shadowPropertyFallback(): Plugin {
  return {
    postcssPlugin: "illustrata-shadow-property-fallback",
    OnceExit(root, { AtRule, Rule, Declaration }) {
      const defaults: Array<[string, string]> = [];
      root.walkAtRules("property", (atRule) => {
        const name = atRule.params.trim();
        if (!name.startsWith("--")) return;
        let initial: string | undefined;
        atRule.walkDecls("initial-value", (decl) => {
          initial = decl.value;
        });
        if (initial !== undefined) defaults.push([name, initial]);
      });
      if (defaults.length === 0) return;

      const rule = new Rule({ selector: "*, ::before, ::after, ::backdrop" });
      for (const [name, value] of defaults) {
        rule.append(new Declaration({ prop: name, value }));
      }
      const layer = new AtRule({ name: "layer", params: "base" });
      layer.append(rule);
      root.append(layer);
    },
  };
}

shadowPropertyFallback.postcss = true as const;
