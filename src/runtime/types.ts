import type { CalculatorWorkspaceUser } from "../contract/index";
export interface EmbedColors {
  accentColor: string | null;
  accentFontColor: string | null;
  buttonColor: string | null;
  buttonFontColor: string | null;
  hoverColor: string | null;
  hoverFontColor: string | null;
  baseColor: string | null;
  baseFontColor: string | null;
  secondaryColor: string | null;
  secondaryFontColor: string | null;
  eyebrowColor: string | null;
}

export interface EmbedFonts {
  headingFamily: string | null;
  headingWeights: string | null;
  bodyFamily: string | null;
  bodyWeights: string | null;
}

export type VariantKind =
  | "myga"
  | "fia-accum"
  | "fia-bonus"
  | "fia-glwb"
  | "spia"
  | "dia";

export interface VariantSummary {
  id: string;
  displayName: string;
  sparkProductCode: string;
  kind: VariantKind;
  displayOrder: number;
  allowedStates: string[] | null;
}

export interface EmbedProduct {
  slug: string;
  name: string;
  allowedStates: string[] | null;
  variants: VariantSummary[];
}

export interface EmbedLaunchContext {
  version: 1;
  integrationKey: string;
  externalCaseId: string;
  data: Record<string, unknown>;
}

export interface EmbedResultDelivery {
  launchId: string;
  parentOrigin: string;
}

export interface HostedToolUser {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface EmbedConfigResponse {
  workspace?: { version: 1; user: CalculatorWorkspaceUser } | null;
  embedType: string;
  products: EmbedProduct[];
  colors: EmbedColors;
  fonts: EmbedFonts;
  launchContext?: EmbedLaunchContext | null;
  resultDelivery?: EmbedResultDelivery | null;
  hostedToolUser?: HostedToolUser | null;
  /** Selected visual skin for templates that support skinning. Null = default. */
  skinId?: string | null;
}

export interface MountProps {
  workspace?: { version: 1; user: CalculatorWorkspaceUser } | null;
  apiBase: string;
  embedToken: string;
  products: EmbedProduct[];
  colors: EmbedColors;
  fonts: EmbedFonts;
  launchContext?: EmbedLaunchContext | null;
  resultDelivery?: EmbedResultDelivery | null;
  hostedToolUser?: HostedToolUser | null;
  /** Selected visual skin for templates that support skinning. Null = default. */
  skinId?: string | null;
}

export type TemplateMount = (
  host: ShadowRoot,
  props: MountProps,
) => void | (() => void);

export interface TemplateModule {
  mount: TemplateMount;
}

