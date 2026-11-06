import type { CalculatorProduct } from "../contract/index.js";

/**
 * Structural variant kinds the Illustrata portal stores on product variants
 * (`product_variants.kind`). A kind describes the shape of a product, never
 * its identity. Mirrors the host runtime's `VariantKind`.
 */
export const VARIANT_KINDS = ["myga", "fia-accum", "fia-bonus", "fia-glwb", "spia", "dia"] as const;
export type VariantKind = (typeof VARIANT_KINDS)[number];

export interface PortalVariant {
  id: string;
  displayName: string;
  sparkProductCode: string | null;
  kind: VariantKind;
  displayOrder: number;
  allowedStates: string[] | null;
}

export interface PortalProduct {
  slug: string;
  name: string;
  allowedStates: string[] | null;
  /** Sorted by `displayOrder`. Never empty for a parsed product. */
  variants: PortalVariant[];
  /** Optional profile from the product's template configuration (`templateConfig.settings.profile`). */
  profile: string | null;
}

export type ParsedProduct =
  | { ok: true; product: PortalProduct }
  | { ok: false; slug: string; name: string; reason: string };

const KIND_SET: ReadonlySet<string> = new Set(VARIANT_KINDS);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function readVariant(candidate: Record<string, unknown>): PortalVariant | null {
  const { id, displayName, sparkProductCode, kind, displayOrder, allowedStates } = candidate;
  if (typeof id !== "string" || !id) return null;
  if (typeof displayName !== "string" || !displayName) return null;
  if (sparkProductCode !== undefined && sparkProductCode !== null && typeof sparkProductCode !== "string") return null;
  if (typeof kind !== "string" || !KIND_SET.has(kind)) return null;
  if (displayOrder !== undefined && !Number.isInteger(displayOrder)) return null;
  if (allowedStates !== undefined && allowedStates !== null && !isStringArray(allowedStates)) return null;
  return {
    id,
    displayName,
    sparkProductCode: typeof sparkProductCode === "string" ? sparkProductCode : null,
    kind: kind as VariantKind,
    displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
    allowedStates: isStringArray(allowedStates) ? [...allowedStates] : null,
  };
}

function readProfile(raw: CalculatorProduct): string | null {
  const config = (raw as { templateConfig?: unknown }).templateConfig;
  if (!config || typeof config !== "object") return null;
  const settings = (config as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object") return null;
  const profile = (settings as { profile?: unknown }).profile;
  return typeof profile === "string" && profile.length > 0 ? profile : null;
}

/**
 * Validates one product from the host config. Fails closed: a variant with an
 * unknown kind makes the whole product unavailable rather than guessing.
 */
export function parseProduct(raw: CalculatorProduct): ParsedProduct {
  const variants: PortalVariant[] = [];
  for (const candidate of raw.variants) {
    const variant = readVariant(candidate);
    if (!variant) {
      const id = typeof candidate.id === "string" ? candidate.id : "?";
      const kind = typeof candidate.kind === "string" ? candidate.kind : "missing";
      return {
        ok: false,
        slug: raw.slug,
        name: raw.name,
        reason: `Variant "${id}" has an unsupported configuration (kind: ${kind}). Fix the variant in the admin portal.`,
      };
    }
    variants.push(variant);
  }
  if (variants.length === 0) {
    return {
      ok: false,
      slug: raw.slug,
      name: raw.name,
      reason: "Product has no variants. Add at least one variant with a kind in the admin portal.",
    };
  }
  variants.sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    ok: true,
    product: { slug: raw.slug, name: raw.name, allowedStates: raw.allowedStates, variants, profile: readProfile(raw) },
  };
}

export function parseProducts(raw: readonly CalculatorProduct[]): ParsedProduct[] {
  return raw.map(parseProduct);
}

/** The minimum a product module exposes for resolution. */
export interface ResolvableModule {
  readonly key: string;
  readonly supportedKinds: readonly VariantKind[];
}

export type ModuleResolution<M extends ResolvableModule> =
  | { ok: true; module: M }
  | { ok: false; reason: string };

export function productKinds(product: PortalProduct): VariantKind[] {
  return [...new Set(product.variants.map((variant) => variant.kind))];
}

export function supportsKinds(module: ResolvableModule, kinds: readonly VariantKind[]): boolean {
  return kinds.every((kind) => module.supportedKinds.includes(kind));
}

/**
 * Picks the one product module for a product. There is deliberately no
 * default: an unknown, unsupported or ambiguous configuration fails closed
 * with a message the admin can act on.
 *
 * 1. An explicit product profile must name a registered module that supports
 *    every variant kind on the product.
 * 2. Otherwise exactly one registered module must support every kind.
 */
export function resolveProductModule<M extends ResolvableModule>(
  product: PortalProduct,
  modules: readonly M[],
): ModuleResolution<M> {
  const kinds = productKinds(product);
  if (kinds.length === 0) return { ok: false, reason: `${product.name} has no variants.` };

  if (product.profile) {
    const match = modules.find((module) => module.key === product.profile);
    if (!match) {
      return { ok: false, reason: `Profile "${product.profile}" is set on ${product.name}, but no product module with that key is registered.` };
    }
    if (!supportsKinds(match, kinds)) {
      return { ok: false, reason: `Profile "${product.profile}" does not support variant kinds ${kinds.join(", ")} on ${product.name}.` };
    }
    return { ok: true, module: match };
  }

  const candidates = modules.filter((module) => supportsKinds(module, kinds));
  if (candidates.length === 1) return { ok: true, module: candidates[0]! };
  if (candidates.length === 0) {
    return { ok: false, reason: `No product module supports variant kinds ${kinds.join(", ")} on ${product.name}. Register a module or fix the variant kinds in the admin portal.` };
  }
  return {
    ok: false,
    reason: `Variant kinds ${kinds.join(", ")} on ${product.name} match more than one product module (${candidates.map((c) => c.key).join(", ")}). Set a product profile to choose one.`,
  };
}
