// Release smoke test: loads a built widget.js in a simulated browser exactly
// the way a page does (a script tag with data attributes), answers the config
// request with test products, and checks that the UI mounted inside a Shadow
// DOM with its stylesheet and without uncaught errors.
//
// It proves the bundle boots. It does not prove the UI is correct; that is
// what preview, tests and staging testing are for.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const API_BASE = 'https://api.smoke.illustrata.test';
const TOKEN = 'smoke-token';
const NULL_COLORS = Object.fromEntries(['accentColor', 'accentFontColor', 'buttonColor', 'buttonFontColor', 'hoverColor', 'hoverFontColor', 'baseColor', 'baseFontColor', 'secondaryColor', 'secondaryFontColor', 'eyebrowColor'].map(key => [key, null]));
const NULL_FONTS = { headingFamily: null, headingWeights: null, bodyFamily: null, bodyWeights: null };

function jsonResponse(window, status, body) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new window.Headers({ 'content-type': 'application/json' }),
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

/**
 * @param {object} options
 * @param {string} options.directory  A release directory (holds release.json and widget.js).
 * @param {unknown[]} [options.products] Host-shaped products for the config response.
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ embedType: string, styleBytes: number, elements: number, requests: string[] }>}
 */
export async function smokeTestRelease({ directory, products = [], timeoutMs = 10_000 }) {
  const release = JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8'));
  const code = readFileSync(join(directory, 'widget.js'), 'utf8');
  const errors = [];
  const requests = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));

  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="illustrata-embed"></div></body></html>', {
    url: 'https://client.smoke.illustrata.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  try {
    window.fetch = async (input) => {
      const url = String(input);
      requests.push(url);
      if (url === `${API_BASE}/api/embed/${TOKEN}`) {
        return jsonResponse(window, 200, { embedType: release.embedType, products, colors: NULL_COLORS, fonts: NULL_FONTS });
      }
      return jsonResponse(window, 404, { error: 'Not available in the smoke test' });
    };
    window.navigator.sendBeacon = () => true;
    // Browser globals jsdom does not provide but every supported browser does.
    window.TextEncoder ??= TextEncoder;
    window.TextDecoder ??= TextDecoder;
    window.structuredClone ??= structuredClone;
    if (!window.crypto?.getRandomValues) Object.defineProperty(window, 'crypto', { value: globalThis.crypto });
    window.matchMedia ??= () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false });
    window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    window.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    window.scrollTo = () => {};
    window.addEventListener('error', event => errors.push(event.message || 'window error'));
    window.addEventListener('unhandledrejection', event => errors.push(`unhandled rejection: ${event.reason?.message ?? event.reason}`));

    const script = window.document.createElement('script');
    script.dataset.embedToken = TOKEN;
    script.dataset.apiBase = API_BASE;
    script.textContent = code;
    window.document.body.appendChild(script);

    const deadline = Date.now() + timeoutMs;
    let container = null;
    let style = null;
    while (Date.now() < deadline) {
      const host = window.document.querySelector('[data-illustrata-widget]');
      const shadow = host?.shadowRoot;
      container = shadow?.querySelector(`[data-illustrata-template="${release.embedType}"]`) ?? null;
      style = shadow?.querySelector('style') ?? null;
      const rendered = window.document.querySelector('[data-illustrata-widget-error]');
      if (rendered) throw new Error(`The runtime rendered an error: ${rendered.textContent}`);
      if (container && container.childElementCount > 0) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    // Let effects and first-render work settle so their errors surface.
    await new Promise(resolve => setTimeout(resolve, 100));
    if (errors.length) throw new Error(`Uncaught errors while mounting:\n  ${errors.join('\n  ')}`);
    if (!container) throw new Error(`No Shadow DOM container for ${release.embedType} appeared within ${timeoutMs} ms`);
    const warnings = [];
    const productBacked = release.calculator?.integration?.type === 'illustrata-products';
    if (container.childElementCount === 0) {
      if (products.length || !productBacked) throw new Error('The UI mounted but rendered nothing');
      warnings.push('Rendered nothing without products. Pass --products <file.json> (or checks.smoke.products) so the test exercises a real screen.');
    }
    const styleBytes = style?.textContent?.length ?? 0;
    if (!styleBytes) warnings.push('CALCULATOR_CSS is empty. Fine if the UI styles itself inline; otherwise its styles did not reach the bundle.');
    return { embedType: release.embedType, styleBytes, elements: container.querySelectorAll('*').length, requests, warnings };
  } finally {
    window.close();
  }
}
