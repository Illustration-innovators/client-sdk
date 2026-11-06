#!/usr/bin/env node
// illustrata-sdk upgrade <version> | sync
import { execFileSync } from 'node:child_process';
import { parseArgs, runCli } from '../lib/args.mjs';
import { checkSync } from '../lib/checks/sync.mjs';
import { SDK_NAME, SDK_VERSION } from '../lib/sdk.mjs';

const USAGE = `illustrata-sdk ${SDK_VERSION}

Usage:
  illustrata-sdk upgrade <version>   Install ${SDK_NAME}@<version> (exact) and update the publish
                                     workflow reference and AGENTS.md to match
  illustrata-sdk sync                Update the workflow reference and AGENTS.md to the installed SDK`;

runCli(async (argv) => {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === 'help') { console.log(USAGE); return 0; }

  if (command === 'upgrade') {
    const { positionals } = parseArgs(rest);
    const version = positionals[0];
    if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Give an exact version, for example: illustrata-sdk upgrade 0.2.0');
    execFileSync('npm', ['install', '--save-dev', '--save-exact', `${SDK_NAME}@${version}`], { stdio: 'inherit' });
    // Run the newly installed version's sync so it writes its own references.
    execFileSync('npx', ['--no-install', 'illustrata-sdk', 'sync'], { stdio: 'inherit' });
    return 0;
  }

  if (command === 'sync') {
    parseArgs(rest);
    const { problems, notes } = checkSync({ root: process.cwd(), fix: true });
    for (const note of notes) console.log(note);
    if (problems.length) { console.error(problems.join('\n')); return 1; }
    console.log(`Synced to ${SDK_NAME} ${SDK_VERSION}.`);
    return 0;
  }

  console.error(`Unknown command "${command}".\n\n${USAGE}`);
  return 1;
});
