import type { EmbedConfigResponse } from "../types";
import { notifyHostedToolSessionExpired } from "../hosted-tool-session";

export async function fetchEmbedConfig(
  apiBase: string,
  embedToken: string,
): Promise<EmbedConfigResponse> {
  const res = await fetch(buildConfigUrl(apiBase, embedToken), {
    method: "GET",
    credentials: credentialRequestMode(embedToken),
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    if (res.status === 401) notifyHostedToolSessionExpired(apiBase, embedToken);
    const message =
      res.status === 404
        ? "Embed not found"
        : `Embed unavailable (${res.status})`;
    throw new Error(message);
  }

  const raw = (await res.json()) as Partial<EmbedConfigResponse>;
  // Defensive default — a backend that hasn't rolled out the fonts field yet
  // would otherwise crash widget code that reads config.fonts.x.
  return {
    embedType: raw.embedType!,
    products: raw.products ?? [],
    colors: raw.colors!,
    fonts: raw.fonts ?? {
      headingFamily: null,
      headingWeights: null,
      bodyFamily: null,
      bodyWeights: null,
    },
    launchContext: raw.launchContext ?? null,
    resultDelivery: raw.resultDelivery ?? null,
    hostedToolUser: raw.hostedToolUser ?? null,
    skinId: raw.skinId ?? null,
    workspace: raw.workspace ?? null,
    browserWorkspace: raw.browserWorkspace ?? null,
  };
}

export function frameCredential(sessionToken: string): string {
  return `frame:${sessionToken}`;
}

export function hostedToolCredential(slug: string): string {
  return `hosted:${slug}`;
}

function isFrameCredential(token: string): boolean {
  return token.startsWith("frame:");
}

function isHostedToolCredential(token: string): boolean {
  return token.startsWith("hosted:");
}

export function credentialRequestMode(token: string): RequestCredentials {
  return isHostedToolCredential(token) ? "same-origin" : "omit";
}

function credentialToken(token: string): string {
  if (isFrameCredential(token)) return token.slice("frame:".length);
  if (isHostedToolCredential(token)) return token.slice("hosted:".length);
  return token;
}

export function buildConfigUrl(apiBase: string, embedToken: string): string {
  const token = credentialToken(embedToken);
  if (isFrameCredential(embedToken)) {
    return `${apiBase}/api/embed-frame/session/${encodeURIComponent(token)}`;
  }
  if (isHostedToolCredential(embedToken)) {
    return `${apiBase}/api/hosted-tools/${encodeURIComponent(token)}`;
  }
  return `${apiBase}/api/embed/${encodeURIComponent(token)}`;
}

export function buildProductUrl(
  apiBase: string,
  embedToken: string,
  productSlug: string,
  query?: string,
): string {
  const token = credentialToken(embedToken);
  let path: string;
  if (isFrameCredential(embedToken)) {
    path = `/api/embed-frame/session/${encodeURIComponent(token)}/${encodeURIComponent(productSlug)}`;
  } else if (isHostedToolCredential(embedToken)) {
    path = `/api/hosted-tools/${encodeURIComponent(token)}/${encodeURIComponent(productSlug)}`;
  } else {
    path = `/api/embed/${encodeURIComponent(token)}/${encodeURIComponent(productSlug)}`;
  }
  return `${apiBase}${path}${query ? `?${query}` : ""}`;
}

function buildClientErrorUrl(apiBase: string, embedToken: string): string {
  const token = credentialToken(embedToken);
  if (isFrameCredential(embedToken)) {
    return `${apiBase}/api/embed-frame/session/${encodeURIComponent(token)}/client-error`;
  }
  if (isHostedToolCredential(embedToken)) {
    return `${apiBase}/api/hosted-tools/${encodeURIComponent(token)}/client-error`;
  }
  return `${apiBase}/api/embed/${encodeURIComponent(token)}/client-error`;
}

export function reportClientError(
  apiBase: string,
  embedToken: string,
  message: string,
  context?: Record<string, unknown>,
  originalRequestId?: string | null,
): void {
  try {
    const url = buildClientErrorUrl(apiBase, embedToken);
    const payload = JSON.stringify({
      message,
      context,
      ...(originalRequestId ? { originalRequestId } : {}),
    });
    // sendBeacon survives page unload; falls back to fetch on pages that disable it.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    fetch(url, {
      method: "POST",
      credentials: credentialRequestMode(embedToken),
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* best-effort — swallow */
    });
  } catch {
    /* never throw from telemetry */
  }
}

export type EmbedErrorCategory =
  | "validation"
  | "session-expired"
  | "rate-limit"
  | "origin-blocked"
  | "not-found"
  | "server-error"
  | "network"
  | "unknown";

/**
 * Error thrown by callEmbedProduct. Carries enough structured information for
 * the widget to show a friendly user message AND ship full technical detail
 * to the client-error telemetry endpoint.
 */
export class EmbedApiError extends Error {
  readonly category: EmbedErrorCategory;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly rawBody: unknown;

  constructor(init: {
    message: string;
    category: EmbedErrorCategory;
    status: number | null;
    requestId: string | null;
    rawBody?: unknown;
  }) {
    super(init.message);
    this.name = "EmbedApiError";
    this.category = init.category;
    this.status = init.status;
    this.requestId = init.requestId;
    this.rawBody = init.rawBody;
  }
}

function categorize(status: number | null): EmbedErrorCategory {
  if (status === null) return "network";
  if (status === 401) return "session-expired";
  if (status === 400 || status === 422) return "validation";
  if (status === 403) return "origin-blocked";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server-error";
  return "unknown";
}

export async function callEmbedProduct<T = unknown>(
  apiBase: string,
  embedToken: string,
  productSlug: string,
  inputs: Record<string, unknown>,
  options: { query?: string | URLSearchParams; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    const query =
      options.query instanceof URLSearchParams
        ? options.query.toString()
        : options.query;
    res = await fetch(
      buildProductUrl(apiBase, embedToken, productSlug, query),
      {
        method: "POST",
        credentials: credentialRequestMode(embedToken),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(inputs),
        signal: options.signal,
      },
    );
  } catch (err) {
    throw new EmbedApiError({
      message: err instanceof Error ? err.message : "Network error",
      category: "network",
      status: null,
      requestId: null,
    });
  }

  const requestId = res.headers.get("X-Request-ID");

  if (!res.ok) {
    let rawBody: unknown = null;
    let serverMessage: string | null = null;
    try {
      rawBody = await res.json();
      if (rawBody && typeof rawBody === "object") {
        const body = rawBody as {
          error?: string;
          message?: string;
          requestId?: string;
        };
        serverMessage = body.error ?? body.message ?? null;
      }
    } catch {
      /* non-JSON error body — leave rawBody null */
    }
    if (res.status === 401) notifyHostedToolSessionExpired(apiBase, embedToken);
    throw new EmbedApiError({
      message: serverMessage ?? `Request failed (${res.status})`,
      category: categorize(res.status),
      status: res.status,
      requestId:
        requestId ??
        (typeof rawBody === "object" && rawBody
          ? ((rawBody as { requestId?: string }).requestId ?? null)
          : null),
      rawBody,
    });
  }

  return (await res.json()) as T;
}

export interface CalculatorProductRequestOptions {
  endpoint?: string;
  format?: "json" | "pdf" | "both";
  signal?: AbortSignal;
}

/**
 * Converts the external calculator runtime contract into the JSON embed API
 * query contract. Calculator packages expect PDF requests to resolve to a JSON
 * object containing `pdf.data`, so `pdf` is transported as `format=both`.
 */
export function buildCalculatorProductQuery(
  options: CalculatorProductRequestOptions = {},
): URLSearchParams | undefined {
  const query = new URLSearchParams();
  if (options.endpoint) query.set("endpoint", options.endpoint);
  if (options.format) {
    query.set("format", options.format === "pdf" ? "both" : options.format);
  }
  return query.toString() ? query : undefined;
}

