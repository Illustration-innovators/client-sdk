import type { EmbedColors } from "../types";

const COLOR_VAR_MAP: Array<[keyof EmbedColors, string]> = [
  ["accentColor", "--illustrata-accent"],
  ["accentFontColor", "--illustrata-accent-font"],
  ["buttonColor", "--illustrata-button"],
  ["buttonFontColor", "--illustrata-button-font"],
  ["hoverColor", "--illustrata-hover"],
  ["hoverFontColor", "--illustrata-hover-font"],
  ["baseColor", "--illustrata-base"],
  ["baseFontColor", "--illustrata-base-font"],
  ["secondaryColor", "--illustrata-secondary"],
  ["secondaryFontColor", "--illustrata-secondary-font"],
  ["eyebrowColor", "--illustrata-eyebrow"],
];

export function applyColorVars(host: HTMLElement, colors: EmbedColors) {
  for (const [key, cssVar] of COLOR_VAR_MAP) {
    const value = colors[key];
    if (value) {
      host.style.setProperty(cssVar, value);
    }
  }
}

