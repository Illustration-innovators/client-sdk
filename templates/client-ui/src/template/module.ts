import type { ReactNode } from "react";
import type { IllustrataCalculatorRuntime } from "@illustrata/client-sdk/contract";
import type { PortalProduct, ResolvableModule, VariantKind } from "@illustrata/client-sdk/products";

/** What a product screen receives. */
export interface ProductScreenProps {
  product: PortalProduct;
  runtime: IllustrataCalculatorRuntime;
}

/**
 * One product module: everything specific to a kind of product (fields,
 * validation, payload, results, styles). The template picks a module per
 * portal product from the variant kinds, or from an explicit product profile,
 * and fails closed when none or several fit (`resolveProductModule`).
 */
export interface ProductModule extends ResolvableModule {
  /** Stable key; also the product profile name an admin can set. */
  readonly key: string;
  readonly label: string;
  readonly supportedKinds: readonly VariantKind[];
  /** Module CSS appended to the template stylesheet. */
  readonly css?: string;
  Screen(props: ProductScreenProps): ReactNode;
}
