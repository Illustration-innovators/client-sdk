export type CalculatorDeliveryMode =
  | "javascript"
  | "iframe"
  | "secure-iframe"
  | "hosted-tool";

export type CalculatorIntegration =
  | { type: "standalone" }
  | {
      type: "illustrata-products";
      productBinding: "single" | "multiple";
      productContractKeys: string[];
      endpointRoles: string[];
      compatibleProductTypes: string[];
    };

export interface CalculatorManifest {
  publication?: { independent: boolean };
  schemaVersion: 1;
  runtimeContractVersion: 1;
  embedType: string;
  clientKey: string;
  calculatorKey: string;
  displayName: string;
  description: string;
  integration: CalculatorIntegration;
  deliveryModes: CalculatorDeliveryMode[];
  requiredCapabilities?: Array<"staff-workspace-v1">;
}

export interface CalculatorProduct {
  slug: string;
  name: string;
  allowedStates: string[] | null;
  variants: Array<Record<string, unknown>>;
}

/** Optional staff workspace capability, supplied only by an authorized Hosted Tool. */
export interface CalculatorWorkspaceUser {
  id: string;
  name: string;
  email: string;
}
export interface CalculatorWorkspaceCase {
  id: string;
  displayName: string;
  status: "draft" | "complete";
  version: number;
  workingInputs?: Record<string, unknown>;
  currentRunId: string | null;
  lastModifiedAt: string;
  expiresAt: string;
  clientName: string | null;
  clientAge: number | null;
  state: string | null;
  productDisplayName: string | null;
  productTypeDisplayName: string | null;
  premium: number | null;
  illustrationDate: string | null;
  canViewPdf: boolean;
  canStartApplication: boolean;
}
export interface CalculatorWorkspaceList {
  items: CalculatorWorkspaceCase[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filterOptions: { products: string[]; states: string[] };
}
export interface CalculatorWorkspaceSave {
  version: number;
  displayName?: string;
  workingInputs?: Record<string, unknown>;
}
export interface CalculatorWorkspace {
  version: 1;
  user: CalculatorWorkspaceUser;
  /** Preview adapters are explicit; live transport never falls back to fixtures. */
  preview?: boolean;
  listCases(query?: URLSearchParams): Promise<CalculatorWorkspaceList>;
  createCase(displayName?: string): Promise<CalculatorWorkspaceCase>;
  getCase(id: string): Promise<CalculatorWorkspaceCase>;
  saveCase(
    id: string,
    body: CalculatorWorkspaceSave
  ): Promise<CalculatorWorkspaceCase>;
  duplicateCase(
    id: string,
    displayName?: string
  ): Promise<CalculatorWorkspaceCase>;
  deleteCase(id: string): Promise<void>;
}

export interface IllustrataCalculatorRuntime {
  workspace?: CalculatorWorkspace;
  products: CalculatorProduct[];
  launchContext?: Record<string, unknown> | null;
  calculate<T>(
    productSlug: string,
    inputs: Record<string, unknown>,
    options?: {
      endpoint?: string;
      format?: "json" | "pdf" | "both";
      signal?: AbortSignal;
    }
  ): Promise<T>;
  reportError(error: unknown, context?: Record<string, unknown>): void;
}
