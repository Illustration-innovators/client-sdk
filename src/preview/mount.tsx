import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

/**
 * Local preview only. Mounts a UI the way the Illustrata host does: a wrapper
 * carrying the `--illustrata-*` branding variables, an open Shadow DOM, the
 * stylesheet, then the React root. Returns an unmount function.
 *
 * The release itself is mounted by the runtime (`src/runtime`), not by this.
 */
export interface MountPreviewOptions {
  target: HTMLElement;
  css: string;
  /** Release name, set as `data-illustrata-template` like the real host. */
  embedType: string;
  /** Branding variables the portal theme would supply, e.g. `{ "--illustrata-accent": "#0b3d91" }`. */
  brandVars?: Record<string, string>;
  render(host: HTMLElement): ReactNode;
}

export function mountPreview({ target, css, embedType, brandVars = {}, render }: MountPreviewOptions): () => void {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-illustrata-widget", "");
  wrapper.style.all = "initial";
  wrapper.style.display = "block";
  wrapper.style.width = "100%";
  for (const [name, value] of Object.entries(brandVars)) wrapper.style.setProperty(name, value);
  const shadowRoot = wrapper.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  const container = document.createElement("div");
  container.setAttribute("data-illustrata-template", embedType);
  shadowRoot.append(style, container);
  target.appendChild(wrapper);
  const root: Root = createRoot(container);
  root.render(render(wrapper));
  return () => {
    root.unmount();
    wrapper.remove();
  };
}

/** Adds page-level CSS once (for preview controls outside the shadow root). */
export function injectPageCss(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
