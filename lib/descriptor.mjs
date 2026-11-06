// Calculator manifest and canonical descriptor rules.
//
// Ported from the calculators repository (scripts/calculator-descriptor.mjs,
// main 2026-11-04). The rules mirror the platform registrar
// (illustrata_monorepo packages/db/src/calculator-definition.ts). The
// descriptor's key order and bytes are part of the release identity: do not
// reorder keys or change normalization without a platform change first.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const productTypes = new Set(['illustration-demo', 'chartline-index-visualizer', 'prosperity-template', 'arcus-template']);
const modes = new Set(['javascript', 'iframe', 'secure-iframe', 'hosted-tool']);

function text(value, max, label) {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value || /[\u0000-\u001f\u007f-\u009f]/.test(value)) throw new Error(`Invalid calculator ${label}`);
  return value;
}

function list(value, allowed, label, max = 30) {
  if (!Array.isArray(value) || !value.length || value.length > max || new Set(value).size !== value.length || value.some(item => typeof item !== 'string' || item.length > 100 || !(allowed instanceof Set ? allowed.has(item) : allowed.test(item)))) throw new Error(`Invalid calculator ${label}`);
  return [...value];
}

export function calculatorDescriptor(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.runtimeContractVersion !== 1) throw new Error('Unsupported calculator contract');
  const embedType = text(manifest.embedType, 101, 'embedType');
  if (!/^[a-z][a-z0-9-]{0,100}$/.test(embedType)) throw new Error('Invalid calculator embedType');
  for (const key of ['clientKey', 'calculatorKey']) if (!keyPattern.test(text(manifest[key], 100, key))) throw new Error(`Invalid calculator ${key}`);
  const source = manifest.integration;
  let integration;
  if (source?.type === 'standalone') integration = { type: 'standalone' };
  else if (source?.type === 'illustrata-products' && ['single', 'multiple'].includes(source.productBinding)) integration = {
    type: 'illustrata-products', productBinding: source.productBinding,
    productContractKeys: list(source.productContractKeys, keyPattern, 'productContractKeys'),
    endpointRoles: list(source.endpointRoles, keyPattern, 'endpointRoles'),
    compatibleProductTypes: list(source.compatibleProductTypes, productTypes, 'compatibleProductTypes', 4),
  };
  else throw new Error('Invalid calculator integration');
  const descriptor = { schemaVersion: 1, runtimeContractVersion: 1, embedType, clientKey: manifest.clientKey, calculatorKey: manifest.calculatorKey, displayName: text(manifest.displayName, 200, 'displayName'), description: text(manifest.description, 2000, 'description'), integration, deliveryModes: list(manifest.deliveryModes, modes, 'deliveryModes', 4) };
  if (manifest.requiredCapabilities !== undefined) {
    const capabilities = list(manifest.requiredCapabilities, new Set(['staff-workspace-v1']), 'requiredCapabilities', 1);
    if (integration.type !== 'illustrata-products' || descriptor.deliveryModes.length !== 1 || descriptor.deliveryModes[0] !== 'hosted-tool') throw new Error('Staff workspace capability requires product-backed Hosted Tool-only delivery');
    // Append only when present. Historical canonical descriptor bytes stay exact.
    descriptor.requiredCapabilities = capabilities;
  }
  return descriptor;
}

/** Published path of an optional server-side Calculator API module. */
export const SERVER_MODULE_PATH = 'assets/server/api.mjs';

/** Source-manifest-only `api.entry`. It never enters the descriptor, so
 * historical canonical descriptor bytes stay exact. */
export function serverModuleEntry(manifest) {
  if (manifest.api === undefined) return undefined;
  const api = manifest.api;
  if (!api || typeof api !== 'object' || Array.isArray(api) || Object.keys(api).join(',') !== 'entry'
    || typeof api.entry !== 'string' || !/^src\/[a-zA-Z0-9_-]+\.(?:js|mjs|ts)$/.test(api.entry)) throw new Error('Invalid calculator api entry');
  // The server module runs without IllustrataCalculatorRuntime, so it cannot call products.
  if (manifest.integration?.type !== 'standalone') throw new Error('Calculator API modules require a standalone integration');
  return api.entry;
}

/** `publication` is optional; when present it is exactly `{ independent: boolean }`. */
export function publicationEnabled(manifest) {
  if (manifest.publication === undefined) return false;
  const publication = manifest.publication;
  if (!publication || typeof publication !== 'object' || Object.keys(publication).join(',') !== 'independent' || typeof publication.independent !== 'boolean') throw new Error('Invalid calculator publication eligibility');
  return publication.independent;
}

export const MANIFEST_FILE = 'calculator.manifest.json';

export function readManifest(directory) {
  const path = join(directory, MANIFEST_FILE);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  calculatorDescriptor(manifest);
  publicationEnabled(manifest);
  serverModuleEntry(manifest);
  return manifest;
}

/** Release names are `<clientKey>--<tool>`. Older calculators predate the rule. */
export function namespaceWarnings(manifest) {
  return manifest.embedType.startsWith(`${manifest.clientKey}--`)
    ? []
    : [`embedType "${manifest.embedType}" does not start with "${manifest.clientKey}--". New release names must; the platform rejects new names that do not.`];
}
