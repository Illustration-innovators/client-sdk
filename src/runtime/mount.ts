import { applyColorVars } from "./theme/color-vars";
import { applyFontVars, injectGoogleFontsLink } from "./theme/font-vars";
import type { EmbedColors, EmbedFonts } from "./types";

export interface MountHost {
  wrapper: HTMLElement;
  shadowRoot: ShadowRoot;
}

export function createMountHost(
  target: HTMLElement,
  colors: EmbedColors,
  fonts: EmbedFonts,
): MountHost {
  target.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-illustrata-widget", "");
  wrapper.style.all = "initial";
  wrapper.style.display = "block";
  wrapper.style.width = "100%";
  wrapper.style.fontFamily = "inherit";

  applyColorVars(wrapper, colors);
  applyFontVars(wrapper, fonts);
  injectGoogleFontsLink(fonts);

  const shadowRoot = wrapper.attachShadow({ mode: "open" });
  target.appendChild(wrapper);

  return { wrapper, shadowRoot };
}

export function renderError(target: HTMLElement, message: string) {
  const el = document.createElement("div");
  el.setAttribute("data-illustrata-widget-error", "");
  el.style.cssText =
    "padding:12px 16px;border:1px solid #f5c6cb;background:#f8d7da;color:#721c24;border-radius:4px;font:14px/1.4 system-ui,sans-serif;";
  el.textContent = `Illustrata embed: ${message}`;
  target.replaceChildren(el);
}

