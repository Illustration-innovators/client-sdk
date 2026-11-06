#!/usr/bin/env node
// illustrata-release validate | build | publish
import { resolve } from 'node:path';
import { parseArgs, runCli } from '../lib/args.mjs';
import { calculatorDescriptor, namespaceWarnings, publicationEnabled, readManifest } from '../lib/descriptor.mjs';
import { loadIllustrataConfig } from '../lib/config.mjs';
import { buildRelease } from '../lib/build.mjs';
import { publishRelease } from '../lib/publish.mjs';
import { SDK_VERSION } from '../lib/sdk.mjs';

const USAGE = `illustrata-release ${SDK_VERSION}

Usage:
  illustrata-release validate [--dir <tool dir>]
  illustrata-release build    [--dir <tool dir>] [--out <dir>] [--source-commit <sha>]
                              [--require-publication] [--no-version-stamp]
  illustrata-release publish  [<releases dir>] [--bucket <name>]

validate  Checks calculator.manifest.json and illustrata.config against the platform's rules.
build     Builds widget.js, assets/calculator.json and release.json under
          <out>/<embedType>/<releaseId>/ (default out: dist/widget-releases).
publish   Uploads one built release to the staging bucket with write-once requests.
          Needs AWS credentials for this repository's publish role, GITHUB_SHA,
          and the bucket from --bucket or ILLUSTRATA_RELEASE_BUCKET.`;

runCli(async (argv) => {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === 'help') { console.log(USAGE); return 0; }

  if (command === 'validate') {
    const { flags } = parseArgs(rest, { strings: ['dir'] });
    const dir = resolve(flags.dir ?? '.');
    const manifest = readManifest(dir);
    const descriptor = calculatorDescriptor(manifest);
    const { path } = await loadIllustrataConfig(dir, process.cwd());
    for (const warning of namespaceWarnings(manifest)) console.warn(`Warning: ${warning}`);
    console.log(`Valid: ${descriptor.embedType} (${descriptor.integration.type}; ${descriptor.deliveryModes.join(', ')}; publication.independent=${publicationEnabled(manifest)})${path ? `; config ${path}` : '; no illustrata.config'}`);
    return 0;
  }

  if (command === 'build') {
    const { flags } = parseArgs(rest, { strings: ['dir', 'out', 'source-commit'], booleans: ['require-publication', 'version-stamp'] });
    const result = await buildRelease({ dir: flags.dir, outDir: flags.out, sourceCommit: flags.sourceCommit, requirePublication: flags.requirePublication, versionStamp: flags.versionStamp });
    for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
    console.log(JSON.stringify({ directory: result.directory, embedType: result.release.embedType, releaseId: result.release.releaseId, integrity: result.release.integrity, sizeBytes: result.bytes.length }, null, 2));
    return 0;
  }

  if (command === 'publish') {
    const { flags, positionals } = parseArgs(rest, { strings: ['bucket'] });
    publishRelease({
      releasesRoot: positionals[0] ?? 'dist/widget-releases',
      bucket: flags.bucket ?? process.env.ILLUSTRATA_RELEASE_BUCKET ?? process.env.CALCULATOR_CANDIDATE_BUCKET,
      expectedCommit: process.env.GITHUB_SHA,
    });
    return 0;
  }

  console.error(`Unknown command "${command}".\n\n${USAGE}`);
  return 1;
});
