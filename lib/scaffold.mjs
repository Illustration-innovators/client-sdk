// Writes a new client UI repository from templates/client-ui: the same layout,
// checks and workflows as the live client repositories, pinned to this SDK
// version, with one example product module to replace.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { SDK_ROOT, SDK_VERSION } from './sdk.mjs';
import { sharedAgentsBlock } from './checks/sync.mjs';

export const TEMPLATE_DIR = join(SDK_ROOT, 'templates/client-ui');
export const DEFAULT_OWNERS = '@benrutt99 @ianmartens23';
const KEY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function title(text) {
  return text.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/** Template paths keep dotfiles as `dot-<name>` so npm packs them. */
function outputPath(path) {
  return path.split('/').map(part => (part.startsWith('dot-') ? `.${part.slice(4)}` : part)).join('/');
}

function listFiles(dir, base = dir) {
  return readdirSync(dir).sort().flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path, base) : [relative(base, path)];
  });
}

/**
 * @param {object} options
 * @param {string} options.clientKey  Portal client key, e.g. `acme`. Becomes the release name prefix.
 * @param {string} options.directory  Where to write; must not exist or be empty.
 * @param {string} [options.name]     Display name, e.g. `Acme Life`.
 * @param {string} [options.tool]     Tool key; the release name is `<clientKey>--<tool>`.
 * @param {string} [options.owners]   CODEOWNERS for release identity, trust and build files.
 * @returns {{ directory: string, embedType: string, files: string[] }}
 */
export function scaffoldClientUi({ clientKey, directory, name, tool = 'illustration', owners = DEFAULT_OWNERS }) {
  if (!clientKey || !KEY.test(clientKey) || clientKey.length > 40) throw new Error('The client key must be lowercase letters, digits and single hyphens, starting with a letter (it must equal the client key in the Illustrata portal).');
  if (!KEY.test(tool) || tool.length > 40) throw new Error('--tool must be lowercase letters, digits and single hyphens, starting with a letter.');
  if (!/^(@[A-Za-z0-9][\w.-]*(\/[\w.-]+)?\s*)+$/.test(owners.trim())) throw new Error('--owners takes GitHub handles such as "@alice @org/team".');
  const target = resolve(directory);
  if (existsSync(target) && readdirSync(target).length) throw new Error(`${target} is not empty.`);
  const values = {
    __CLIENT_KEY__: clientKey,
    __CLIENT_NAME__: name?.trim() || title(clientKey),
    __TOOL__: tool,
    __TOOL_TITLE__: title(tool),
    __SDK_VERSION__: SDK_VERSION,
    __OWNERS__: owners.trim().split(/\s+/).join(' '),
  };
  const files = [];
  for (const file of listFiles(TEMPLATE_DIR)) {
    let text = readFileSync(join(TEMPLATE_DIR, file), 'utf8');
    for (const [placeholder, value] of Object.entries(values)) text = text.replaceAll(placeholder, value);
    const out = outputPath(file);
    if (out === 'AGENTS.md') text = `${text.trimEnd()}\n\n${sharedAgentsBlock()}\n`;
    const path = join(target, out);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    files.push(out);
  }
  const leftover = files.filter(file => /__[A-Z_]+__/.test(readFileSync(join(target, file), 'utf8')));
  if (leftover.length) throw new Error(`Unfilled placeholders in ${leftover.join(', ')}`);
  return { directory: target, embedType: `${clientKey}--${tool}`, files };
}
