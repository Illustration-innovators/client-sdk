// Release screenshots: loads a built widget.js in real Chromium exactly the
// way a page does (a script tag with data attributes), answers the config
// request with test products, and saves a full-page PNG per product and width.
// For pull request review: people see the change without running anything.
//
// Requires the optional peer dependency `playwright` and its Chromium:
//   npm i -D playwright && npx playwright install chromium
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE_ORIGIN = 'https://client.screenshots.illustrata.test';
const API_BASE = 'https://api.screenshots.illustrata.test';
const TOKEN = 'screenshot-token';
const NULL_COLORS = Object.fromEntries(['accentColor', 'accentFontColor', 'buttonColor', 'buttonFontColor', 'hoverColor', 'hoverFontColor', 'baseColor', 'baseFontColor', 'secondaryColor', 'secondaryFontColor', 'eyebrowColor'].map(key => [key, null]));
const NULL_FONTS = { headingFamily: null, headingWeights: null, bodyFamily: null, bodyWeights: null };
export const DEFAULT_WIDTHS = [390, 1280];

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new Error('Screenshots need Playwright: npm i -D playwright && npx playwright install chromium');
  }
}

/** File-name-safe label for a product. */
export function screenshotName(product, index) {
  const raw = String(product?.slug ?? product?.name ?? `product-${index + 1}`);
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || `product-${index + 1}`;
}

/**
 * @param {object} options
 * @param {string} options.directory  A release directory (holds release.json and widget.js).
 * @param {string} options.outDir     Where PNGs are written.
 * @param {unknown[]} [options.products] Host-shaped products. One screenshot set per product; one set in total without products.
 * @param {number[]} [options.widths]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ embedType: string, files: string[] }>}
 */
export async function screenshotRelease({ directory, outDir, products = [], widths = DEFAULT_WIDTHS, timeoutMs = 15_000 }) {
  const release = JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8'));
  const code = readFileSync(join(directory, 'widget.js'), 'utf8');
  const { chromium } = await loadPlaywright();
  mkdirSync(outDir, { recursive: true });
  const sets = products.length ? products.map((product, index) => ({ name: screenshotName(product, index), products: [product] })) : [{ name: 'default', products: [] }];
  const browser = await chromium.launch();
  const files = [];
  try {
    for (const set of sets) {
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        // Every request is answered here; nothing reaches the network.
        await page.route('**/*', route => {
          const url = route.request().url();
          if (url === `${PAGE_ORIGIN}/`) {
            return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="illustrata-embed"></div><script src="${PAGE_ORIGIN}/widget.js" data-embed-token="${TOKEN}" data-api-base="${API_BASE}"></script></body></html>` });
          }
          if (url === `${PAGE_ORIGIN}/widget.js`) return route.fulfill({ contentType: 'application/javascript', body: code });
          if (url === `${API_BASE}/api/embed/${TOKEN}`) {
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ embedType: release.embedType, products: set.products, colors: NULL_COLORS, fonts: NULL_FONTS }) });
          }
          if (url.startsWith(API_BASE)) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not available in screenshots' }) });
          return route.abort();
        });
        await page.goto(`${PAGE_ORIGIN}/`);
        await page.waitForFunction(embedType => {
          const container = document.querySelector('[data-illustrata-widget]')?.shadowRoot?.querySelector(`[data-illustrata-template="${embedType}"]`);
          return Boolean(document.querySelector('[data-illustrata-widget-error]') || (container && container.childElementCount > 0));
        }, release.embedType, { timeout: timeoutMs });
        const rendered = await page.locator('[data-illustrata-widget-error]').count();
        if (rendered) throw new Error(`The runtime rendered an error: ${await page.locator('[data-illustrata-widget-error]').first().textContent()}`);
        // Let effects, fonts and first-render work settle.
        await page.waitForTimeout(500);
        if (errors.length) throw new Error(`Uncaught errors while mounting:\n  ${errors.join('\n  ')}`);
        const file = join(outDir, `${set.name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        files.push(file);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return { embedType: release.embedType, files };
}
