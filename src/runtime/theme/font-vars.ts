import type { EmbedFonts } from "../types";

const PRECONNECT_GOOGLEAPIS_ID = "illustrata-preconnect-googleapis";
const PRECONNECT_GSTATIC_ID = "illustrata-preconnect-gstatic";
const FONT_LINK_ID = "illustrata-google-fonts-link";

export function applyFontVars(host: HTMLElement, fonts: EmbedFonts) {
  if (fonts.headingFamily) {
    host.style.setProperty(
      "--illustrata-font-heading",
      `"${fonts.headingFamily}", sans-serif`,
    );
  }
  if (fonts.bodyFamily) {
    host.style.setProperty(
      "--illustrata-font-body",
      `"${fonts.bodyFamily}", sans-serif`,
    );
  }
}

// Builds e.g. https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;700&family=Montserrat&display=swap
//
// Weights handling: if the theme stored explicit weights (e.g. "400,700"), we
// emit `:wght@400;700`. If blank, we emit a plain `family=X` — which loads only
// the default weight (400) but works for every Google Font, variable or static.
// We deliberately do NOT emit `wght@100..900` blanket-style: that range syntax
// only works for variable fonts and returns HTTP 400 for static-only families.
// Admins set weights via the theme editor, which validates against Google Fonts
// at edit time so a bad combination never reaches runtime.
const WEIGHTS_REGEX = /^\d{3}(,\d{3})*$/;

function buildGoogleFontsUrl(fonts: EmbedFonts): string | null {
  const families: string[] = [];
  const seen = new Set<string>();

  const add = (family: string | null, weights: string | null) => {
    if (!family) return;
    const key = family.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const familyParam = family.trim().replace(/\s+/g, "+");
    const w = weights?.trim();
    if (w && WEIGHTS_REGEX.test(w)) {
      families.push(`family=${familyParam}:wght@${w.replace(/,/g, ";")}`);
    } else {
      families.push(`family=${familyParam}`);
    }
  };

  add(fonts.headingFamily, fonts.headingWeights);
  add(fonts.bodyFamily, fonts.bodyWeights);

  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

// @font-face / Google Fonts <link> declarations must live on the document
// (not inside the shadow root) for fonts to actually render text inside the
// shadow DOM — same constraint that the existing brand-font loader follows.
export function injectGoogleFontsLink(fonts: EmbedFonts) {
  const url = buildGoogleFontsUrl(fonts);
  if (!url) return;

  if (!document.getElementById(PRECONNECT_GOOGLEAPIS_ID)) {
    const preconnect1 = document.createElement("link");
    preconnect1.id = PRECONNECT_GOOGLEAPIS_ID;
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    document.head.appendChild(preconnect1);
  }
  if (!document.getElementById(PRECONNECT_GSTATIC_ID)) {
    const preconnect2 = document.createElement("link");
    preconnect2.id = PRECONNECT_GSTATIC_ID;
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    document.head.appendChild(preconnect2);
  }

  const existing = document.getElementById(
    FONT_LINK_ID,
  ) as HTMLLinkElement | null;
  if (existing) {
    if (existing.href !== url) existing.href = url;
    return;
  }

  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

