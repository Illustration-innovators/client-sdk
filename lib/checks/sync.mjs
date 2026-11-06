// Keeps a client repository in step with its installed SDK version:
// - every reference to an SDK reusable workflow (`.../publish-release.yml@v<version>`,
//   `.../pr-screenshots.yml@v<version>`);
// - the shared section of AGENTS.md, copied from the SDK's docs/AGENTS_SHARED.md.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PUBLISH_WORKFLOW, SDK_ROOT, SDK_VERSION, SDK_WORKFLOW_PREFIX } from '../sdk.mjs';

export const SHARED_START = '<!-- illustrata-sdk:shared:start -->';
export const SHARED_END = '<!-- illustrata-sdk:shared:end -->';
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const WORKFLOW_REF = new RegExp(`(${escape(SDK_WORKFLOW_PREFIX)}[a-z0-9-]+\\.ya?ml)@([^\\s'"#]+)`, 'g');

export function expectedWorkflowRef(version = SDK_VERSION) {
  return `v${version}`;
}

export function sharedAgentsBlock() {
  const body = readFileSync(join(SDK_ROOT, 'docs/AGENTS_SHARED.md'), 'utf8').trimEnd();
  return `${SHARED_START}\n<!-- Generated from @illustrata/client-sdk ${SDK_VERSION}. Edit it in the SDK, then run \`npx illustrata-sdk sync\`. -->\n\n${body}\n\n${SHARED_END}`;
}

function workflowFiles(root) {
  const dir = join(root, '.github/workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => /\.ya?ml$/.test(name)).map(name => join(dir, name));
}

/**
 * Returns `{ problems, notes }`. With `fix: true`, rewrites what it can and
 * returns what remains.
 */
export function checkSync({ root = process.cwd(), fix = false, strict = false } = {}) {
  const rootDir = resolve(root);
  const problems = [];
  const notes = [];
  const wanted = expectedWorkflowRef();

  let references = 0;
  for (const file of workflowFiles(rootDir)) {
    const text = readFileSync(file, 'utf8');
    let changed = text;
    for (const match of text.matchAll(WORKFLOW_REF)) {
      if (match[1] === PUBLISH_WORKFLOW) references += 1;
      if (match[2] !== wanted) {
        if (fix) changed = changed.replaceAll(match[0], `${match[1]}@${wanted}`);
        else problems.push(`${file}: ${match[1].split('/').pop()} is @${match[2]} but the installed SDK is ${SDK_VERSION} (expected @${wanted}). Run: npx illustrata-sdk sync`);
      }
    }
    if (fix && changed !== text) { writeFileSync(file, changed); notes.push(`Updated ${file} to @${wanted}`); }
  }
  if (references === 0) (strict ? problems : notes).push(`No workflow calls ${PUBLISH_WORKFLOW}. Add the publish workflow (docs/CLIENT_REPO_SETUP.md).`);

  const agentsPath = join(rootDir, 'AGENTS.md');
  if (!existsSync(agentsPath)) {
    (strict ? problems : notes).push('No AGENTS.md. Add one with the shared SDK section (docs/CLIENT_REPO_SETUP.md).');
  } else {
    const text = readFileSync(agentsPath, 'utf8');
    const start = text.indexOf(SHARED_START);
    const end = text.indexOf(SHARED_END);
    const block = sharedAgentsBlock();
    if (start === -1 || end === -1 || end < start) {
      if (fix) { writeFileSync(agentsPath, `${text.trimEnd()}\n\n${block}\n`); notes.push('Added the shared SDK section to AGENTS.md'); }
      else (strict ? problems : notes).push(`AGENTS.md has no shared SDK section (${SHARED_START} ... ${SHARED_END}). Run: npx illustrata-sdk sync`);
    } else {
      const current = text.slice(start, end + SHARED_END.length);
      if (current !== block) {
        if (fix) { writeFileSync(agentsPath, text.replace(current, block)); notes.push('Updated the shared SDK section of AGENTS.md'); }
        else problems.push(`AGENTS.md shared SDK section does not match SDK ${SDK_VERSION}. Run: npx illustrata-sdk sync`);
      }
    }
  }
  return { problems, notes };
}
