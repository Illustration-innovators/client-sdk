import type { IncomingMessage } from "node:http";
import { loadEnv, type Plugin } from "vite";

/**
 * Local development only. A Vite dev-server plugin that forwards the preview's
 * product calls to the Illustrata staging API with a staging test key, so the
 * local preview shows real staging results.
 *
 * Derived from the calculators repository (tooling/development/illustrata-bridge.ts).
 *
 * The key comes from the git-ignored `.env.local` (`ILLUSTRATA_STAGING_API_KEY`)
 * or is pasted into the preview page. It never reaches the browser bundle: the
 * dev server adds it to the upstream request. Requests are accepted only from
 * the local same-origin preview.
 */
const environments = {
  staging: "https://staging-api.cloud.illustrata.io",
  local: "http://localhost:3002",
} as const;

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export interface BridgeOptions {
  /** Staging test key. Default: `ILLUSTRATA_STAGING_API_KEY` from `.env.local` in `envDir`. */
  stagingKey?: string;
  /** Directory holding `.env.local`. Default: the current directory. */
  envDir?: string;
}

export function illustrataDevelopmentBridge(options: BridgeOptions = {}): Plugin {
  const defaultStagingKey =
    options.stagingKey ?? loadEnv("development", options.envDir ?? process.cwd(), "ILLUSTRATA_").ILLUSTRATA_STAGING_API_KEY ?? "";
  return {
    name: "illustrata-development-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__illustrata-preview-config", (request, response) => {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "application/json");
        if (request.method !== "GET") { response.statusCode = 405; response.end("{}"); return; }
        response.end(JSON.stringify({ stagingKeyConfigured: !!defaultStagingKey }));
      });
      server.middlewares.use("/__illustrata", async (request, response) => {
        response.setHeader("content-type", "application/json");
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: "Only POST requests are supported." }));
          return;
        }
        const environment = request.headers["x-illustrata-environment"];
        const apiKey = request.headers["x-illustrata-test-key"] || (environment === "staging" ? defaultStagingKey : "");
        // A file-based credential may only be used by the local same-origin preview.
        if (defaultStagingKey) {
          const host = request.headers.host ?? "";
          if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || request.headers.origin !== `http://${host}`) {
            response.statusCode = 403;
            response.end(JSON.stringify({ error: "Local same-origin requests only." }));
            return;
          }
        }
        if (typeof apiKey !== "string" || !apiKey.trim()) {
          response.statusCode = 401;
          response.end(JSON.stringify({ error: "Enter an Illustrata staging test key in the preview." }));
          return;
        }
        if (environment !== "staging" && environment !== "local") {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "Choose a supported Illustrata environment." }));
          return;
        }
        try {
          const upstream = await fetch(`${environments[environment]}${request.url || "/"}`, {
            method: "POST",
            redirect: "error",
            headers: { "content-type": request.headers["content-type"] || "application/json", "x-api-key": apiKey },
            body: await readBody(request),
          });
          response.statusCode = upstream.status;
          response.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
          response.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          response.statusCode = 502;
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to reach Illustrata." }));
        }
      });
    },
  };
}
