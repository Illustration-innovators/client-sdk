import type {
  CalculatorWorkspace,
  CalculatorWorkspaceCase,
  CalculatorWorkspaceList,
} from "../../contract/index";
import type { EmbedProduct } from "../types";

export class BrowserWorkspaceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "BrowserWorkspaceError";
  }
}

/**
 * The workspace a public Hosted Tool gives its visitors. Cases live in this
 * browser tab's memory only: a refresh or a new tab starts empty, and nothing
 * is sent to the platform. List, search, filter and sort follow the platform's
 * server workspace (`internalWorkspaceCaseService.ts` in the Illustrata
 * monorepo), including its dashboard projection from fixed `formValues` keys.
 */
export function createBrowserWorkspace(
  credential: string,
  products: EmbedProduct[],
  configuration?: { version: 1 } | null
): CalculatorWorkspace | undefined {
  if (configuration?.version !== 1 || !credential.startsWith("hosted:"))
    return undefined;
  const allowedSlugs = new Set(products.map((product) => product.slug));
  const cases = new Map<string, CalculatorWorkspaceCase>();
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  function checkProduct(inputs: Record<string, unknown> | undefined) {
    const slug = inputs?.selectedProductSlug;
    if (
      slug !== undefined &&
      slug !== null &&
      (typeof slug !== "string" || !allowedSlugs.has(slug))
    )
      throw new BrowserWorkspaceError(
        "Selected product is not authorized for this tool",
        400
      );
  }

  /** Dashboard columns, projected like the platform does on the server. */
  function project(item: CalculatorWorkspaceCase): CalculatorWorkspaceCase {
    const inputs = (item.workingInputs ?? {}) as Record<string, unknown>;
    const form =
      inputs.formValues && typeof inputs.formValues === "object"
        ? (inputs.formValues as Record<string, unknown>)
        : {};
    const text = (key: string) =>
      typeof form[key] === "string" && (form[key] as string).trim()
        ? (form[key] as string).trim()
        : null;
    const numeric = (key: string, pattern: RegExp) => {
      const value = form[key];
      return (typeof value === "string" || typeof value === "number") &&
        pattern.test(String(value))
        ? Number(value)
        : null;
    };
    const selectedSlug =
      typeof inputs.selectedProductSlug === "string"
        ? inputs.selectedProductSlug
        : null;
    const variantId = text("Product");
    let productDisplayName: string | null = null;
    for (const product of products) {
      if (variantId !== null) {
        // The platform sends only active variants of authorized products.
        const variant = product.variants.find((candidate) => candidate.id === variantId);
        if (variant && (selectedSlug === null || product.slug === selectedSlug)) {
          productDisplayName = variant.displayName;
          break;
        }
      } else if (product.slug === selectedSlug) {
        productDisplayName = product.name;
        break;
      }
    }
    const state = text("State");
    return {
      ...clone(item),
      clientName:
        [text("OwnFirstName"), text("OwnLastName")].filter(Boolean).join(" ") ||
        null,
      clientAge: numeric("OwnAge", /^[0-9]{1,3}$/),
      state: state && /^[A-Z]{2}$/.test(state) ? state : null,
      productDisplayName,
      premium: numeric("initamt", /^[0-9]{1,15}(\.[0-9]{1,6})?$/),
    };
  }

  function find(id: string) {
    const item = cases.get(id);
    if (!item) throw new BrowserWorkspaceError("Case not found", 404);
    return item;
  }

  function create(displayName: string, workingInputs: Record<string, unknown>) {
    checkProduct(workingInputs);
    const now = new Date().toISOString();
    const item: CalculatorWorkspaceCase = {
      id: newId(),
      displayName,
      status: "draft",
      version: 1,
      workingInputs: clone(workingInputs),
      currentRunId: null,
      lastModifiedAt: now,
      // Ends with the tab; no retention applies.
      expiresAt: now,
      clientName: null,
      clientAge: null,
      state: null,
      productDisplayName: null,
      productTypeDisplayName: null,
      premium: null,
      illustrationDate: null,
      canViewPdf: false,
      canStartApplication: false,
    };
    cases.set(item.id, item);
    return project(item);
  }

  const values = (query: URLSearchParams, key: string) =>
    query.getAll(key).flatMap((value) => value.split(",")).filter(Boolean);
  type Sortable = string | number | null;
  const sortValue = (item: CalculatorWorkspaceCase, sortBy: string | null): Sortable => {
    switch (sortBy) {
      case "name": return item.displayName;
      case "clientName": return item.clientName;
      case "clientAge": return item.clientAge;
      case "state": return item.state;
      case "product": return item.productDisplayName;
      case "premium": return item.premium;
      case "status": return item.status;
      default: return item.lastModifiedAt;
    }
  };

  return {
    version: 1,
    persistence: "browser",
    user: { id: "guest", name: "Guest", email: "" },
    async listCases(query = new URLSearchParams()): Promise<CalculatorWorkspaceList> {
      const all = [...cases.values()].map(project);
      const q = query.get("q")?.trim().toLowerCase();
      const statuses = values(query, "status");
      const productFilters = values(query, "product");
      const stateFilters = values(query, "state");
      const dateFrom = query.get("dateFrom");
      const dateTo = query.get("dateTo");
      let items = all.filter(
        (item) =>
          (!q ||
            [item.displayName, item.clientName, item.productDisplayName].some(
              (value) => value?.toLowerCase().includes(q)
            )) &&
          (!statuses.length || statuses.includes(item.status)) &&
          (!productFilters.length ||
            (item.productDisplayName !== null &&
              productFilters.includes(item.productDisplayName))) &&
          (!stateFilters.length ||
            (item.state !== null && stateFilters.includes(item.state))) &&
          (!dateFrom || item.lastModifiedAt >= dateFrom) &&
          (!dateTo || item.lastModifiedAt <= dateTo)
      );
      const sortBy = query.get("sortBy");
      const direction = query.get("sortDirection") === "asc" ? 1 : -1;
      items = items.sort((a, b) => {
        const x = sortValue(a, sortBy), y = sortValue(b, sortBy);
        if (x === null || y === null)
          return x === y ? a.id.localeCompare(b.id) : x === null ? 1 : -1;
        const order =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y));
        return order * direction || a.id.localeCompare(b.id);
      });
      const pageSize = Math.min(100, Math.max(1, Number(query.get("pageSize")) || 10));
      const page = Math.max(1, Math.floor(Number(query.get("page")) || 1));
      const unique = (list: Array<string | null>) =>
        [...new Set(list.filter((value): value is string => Boolean(value)))].sort();
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
        filterOptions: {
          products: unique(all.map((item) => item.productDisplayName)),
          states: unique(all.map((item) => item.state)),
        },
      };
    },
    async createCase(displayName) {
      return create(displayName?.trim() || "New Illustration", {});
    },
    async getCase(id) {
      return project(find(id));
    },
    async saveCase(id, body) {
      const item = find(id);
      if (item.version !== body.version)
        throw new BrowserWorkspaceError(
          "The illustration changed in another session",
          409
        );
      if (body.workingInputs !== undefined) checkProduct(body.workingInputs);
      if (body.displayName !== undefined) item.displayName = body.displayName;
      if (body.workingInputs !== undefined)
        item.workingInputs = clone(body.workingInputs);
      item.version += 1;
      item.lastModifiedAt = new Date().toISOString();
      return project(item);
    },
    async duplicateCase(id, displayName) {
      const original = find(id);
      return create(
        displayName?.trim() || `${original.displayName.slice(0, 153)} (copy)`,
        (original.workingInputs ?? {}) as Record<string, unknown>
      );
    },
    async deleteCase(id) {
      find(id);
      cases.delete(id);
    },
  };
}
