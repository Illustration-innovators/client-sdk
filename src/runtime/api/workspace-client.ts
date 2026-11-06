import type {
  CalculatorWorkspace,
  CalculatorWorkspaceUser,
} from "../../contract/index";
import { notifyHostedToolSessionExpired } from "../hosted-tool-session";

export class WorkspaceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly currentVersion?: number
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

/** Credential and API location are selected by the host, never by calculator code. */
export function createWorkspaceRuntime(
  apiBase: string,
  credential: string,
  configuration?: { version: 1; user: CalculatorWorkspaceUser } | null
): CalculatorWorkspace | undefined {
  if (
    !configuration ||
    configuration.version !== 1 ||
    !credential.startsWith("hosted:")
  )
    return undefined;
  // A staff cookie must never be sent to a calculator-selected remote host.
  const origin = typeof location !== "undefined" ? location.origin : "";
  const api = new URL(apiBase, origin);
  if (api.origin !== origin) return undefined;
  const slug = credential.slice("hosted:".length);
  if (!slug) return undefined;
  const base = `${api.origin}/api/hosted-tools/${encodeURIComponent(
    slug
  )}/workspace/cases`;
  async function request<T>(path = "", init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (response.status === 401)
      notifyHostedToolSessionExpired(api.origin, credential);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
        currentVersion?: number;
      } | null;
      throw new WorkspaceApiError(
        body?.message ??
          body?.error ??
          `Workspace request failed (${response.status})`,
        response.status,
        body?.currentVersion
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  const idPath = (id: string) => `/${encodeURIComponent(id)}`;
  return {
    version: 1,
    user: { ...configuration.user },
    listCases: (query = new URLSearchParams()) =>
      request(`?${query.toString()}`),
    createCase: (displayName) =>
      request("", {
        method: "POST",
        body: JSON.stringify(
          displayName?.trim() ? { displayName: displayName.trim() } : {}
        ),
      }),
    getCase: (id) => request(idPath(id)),
    saveCase: (id, body) =>
      request(idPath(id), { method: "PATCH", body: JSON.stringify(body) }),
    duplicateCase: (id, displayName) =>
      request(`${idPath(id)}/duplicate`, {
        method: "POST",
        body: JSON.stringify(
          displayName?.trim() ? { displayName: displayName.trim() } : {}
        ),
      }),
    deleteCase: (id) => request(idPath(id), { method: "DELETE" }),
  };
}
