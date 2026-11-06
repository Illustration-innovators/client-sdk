#!/usr/bin/env node
// create-client-ui <clientKey> [directory] [--name "Acme Life"] [--tool illustration] [--owners "@a @b"]
import { parseArgs, runCli } from '../lib/args.mjs';
import { DEFAULT_OWNERS, scaffoldClientUi } from '../lib/scaffold.mjs';
import { SDK_VERSION } from '../lib/sdk.mjs';

const USAGE = `create-client-ui (@illustrata/client-sdk ${SDK_VERSION})

Usage:
  npx -p @illustrata/client-sdk create-client-ui <clientKey> [directory]
      [--name "Acme Life"]      Display name (default: from the client key)
      [--tool illustration]     Release name is <clientKey>--<tool>
      [--owners "${DEFAULT_OWNERS}"]
                                CODEOWNERS for the manifest, config, package and workflows

<clientKey> must equal the client's key in the Illustrata portal.
The directory defaults to <clientKey>-ui.`;

runCli(async (argv) => {
  const { flags, positionals } = parseArgs(argv, { strings: ['name', 'tool', 'owners'], booleans: ['help'] });
  if (flags.help || !positionals[0]) { console.log(USAGE); return flags.help ? 0 : 1; }
  const [clientKey, directory = `${positionals[0]}-ui`] = positionals;
  const result = scaffoldClientUi({ clientKey, directory, name: flags.name, tool: flags.tool, owners: flags.owners });
  console.log(`Created ${result.directory} (${result.files.length} files), release name ${result.embedType}.

Next, in that directory:
  git init -b main && npm install && npx playwright install chromium
  npm run ci && npm run dev

Then (client-sdk docs/CLIENT_REPO_SETUP.md sections 6-7):
  1. Create the GitHub repository under Illustration-innovators and push main.
  2. GitHub: environment "staging-candidates" (main only), variables ILLUSTRATA_AWS_REGION,
     ILLUSTRATA_RELEASE_BUCKET, ILLUSTRATA_PUBLISH_ROLE_ARN, and the main ruleset.
  3. Illustrata: add the repository to calculator-publishers/terraform.tfvars, apply,
     and add ${clientKey} to CLIENT_REPOSITORIES in the admin's release-labels.ts.
  4. Set "publication.independent": true in calculator.manifest.json and
     ILLUSTRATA_PUBLISH_ENABLED=true when the first release should publish.
  5. Portal: client "${clientKey}", products, a staging Hosted Tool (docs/PORTAL_SETUP.md).`);
  return 0;
});
