import {
  fetchEmbedConfig,
  frameCredential,
  hostedToolCredential,
  reportClientError,
} from "./api/embed-client";
import { createMountHost, renderError } from "./mount";
import {
  onHostedToolSessionExpired,
  renderHostedToolSessionExpired,
} from "./hosted-tool-session";
import type { TemplateMount } from "./types";

/**
 * Runs when a per-template bundle loads. Each template ships its own IIFE with
 * a call to runTemplate(...) at the bottom. The bundle knows its own template
 * name statically — no registry lookup needed at runtime.
 */
export function runTemplate(expectedEmbedType: string, mount: TemplateMount) {
  // Capture synchronously: currentScript becomes null after DOMContentLoaded.
  // Each IIFE must retain its own credentials on pages with multiple embeds.
  const script = document.currentScript as HTMLScriptElement | null;
  async function boot() {

    const frameSession = script?.dataset.frameSession;
    const hostedToolSlug = script?.dataset.hostedToolSlug;
    const embedToken = frameSession
      ? frameCredential(frameSession)
      : hostedToolSlug
        ? hostedToolCredential(hostedToolSlug)
        : script?.dataset.embedToken;
    const apiBase = script?.dataset.apiBase;
    const targetSelector = script?.dataset.target ?? "#illustrata-embed";

    if (!script || !embedToken || !apiBase) {
      console.error(
        `[illustrata:${expectedEmbedType}] Missing widget credentials or data-api-base on <script>`,
      );
      return;
    }

    // onError listeners for this template's bundle — fires for any uncaught errors.
    const onError = (event: ErrorEvent) => {
      reportClientError(
        apiBase,
        embedToken,
        event.message ?? "window.onerror",
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          template: expectedEmbedType,
        },
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandledrejection";
      reportClientError(apiBase, embedToken, message, {
        stack: reason instanceof Error ? reason.stack : undefined,
        template: expectedEmbedType,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!target) {
      console.error(
        `[illustrata:${expectedEmbedType}] Target ${targetSelector} not found`,
      );
      return;
    }

    let teardown: void | (() => void);
    const stopListeningForSessionExpiry = onHostedToolSessionExpired(
      (signInUrl) => {
        stopListeningForSessionExpiry();
        window.setTimeout(() => {
          teardown?.();
          renderHostedToolSessionExpired(target, signInUrl);
        }, 0);
      },
    );
    const cleanup = () => {
      stopListeningForSessionExpiry();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };

    let config;
    try {
      config = await fetchEmbedConfig(apiBase, embedToken);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load embed config";
      renderError(target, message);
      reportClientError(apiBase, embedToken, `config fetch failed: ${message}`);
      cleanup();
      return;
    }

    if (config.embedType !== expectedEmbedType) {
      const message = `Template mismatch: bundle is "${expectedEmbedType}" but embed is "${config.embedType}"`;
      renderError(target, message);
      reportClientError(apiBase, embedToken, message);
      cleanup();
      return;
    }

    const { shadowRoot } = createMountHost(target, config.colors, config.fonts);
    teardown = mount(shadowRoot, {
      apiBase,
      embedToken,
      products: config.products,
      colors: config.colors,
      fonts: config.fonts,
      launchContext: config.launchContext ?? null,
      resultDelivery: config.resultDelivery ?? null,
      hostedToolUser: config.hostedToolUser ?? null,
      skinId: config.skinId ?? null,
      workspace: config.workspace ?? null,
      browserWorkspace: config.browserWorkspace ?? null,
    });
    const observer = new MutationObserver(() => {
      if (!target.isConnected || !shadowRoot.host.isConnected) {
        observer.disconnect();
        teardown?.();
        cleanup();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void boot();
    });
  } else {
    void boot();
  }
}
