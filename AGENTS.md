# client-sdk - Agent Operating Instructions

Last updated: 2026-11-06

This repository is shared by every Illustrata client UI repository and, later,
the calculators repository. A change here reaches every client that upgrades.
Read this file before changing anything.

## What lives where

| Path | What it is | Change risk |
| --- | --- | --- |
| `src/runtime/` | Runtime compiled into every release (bootstrap, Shadow DOM mount, theme, platform HTTP and workspace clients) | Highest: changes release bytes and behaviour for every client |
| `lib/descriptor.mjs`, `lib/release.mjs` | Manifest rules, canonical descriptor, release identity | Must match the platform registrar exactly |
| `lib/build.mjs` | The release builder | Changes release bytes |
| `lib/publish.mjs` | The staging publisher | Security-relevant |
| `lib/checks/` | Boundaries, removal, smoke test, sync, drift | Client CI depends on them |
| `src/contract`, `src/products`, `src/preview`, `src/postcss`, `src/config.ts` | Types and helpers client repositories import | Breaking a type is a breaking change |
| `.github/workflows/publish-release.yml` | Reusable workflow every client repository calls | Security-relevant |
| `docs/AGENTS_SHARED.md` | Copied into every client repository's AGENTS.md | Changes what every client's agents are told |

## Rules

- **Release format.** `release.json`, the descriptor key order and normalization,
  the inventory and the release ID must stay byte-compatible with the platform
  registrar (Illustrata monorepo `packages/db/src/calculator-definition.ts`
  and `packages/db/src/calculator-releases.ts`). Never add a field. A format
  change is a platform change first, in the registrar, the admin's staging
  approval import, the backend and the production maintenance image.
- **Runtime.** The runtime was copied from the calculators repository's
  `tooling/widget-runtime` and must stay equal to it until the calculators
  repository adopts this SDK (`illustrata-check drift`). Change both, or
  neither. Runtime changes are runtime contract changes when they alter what
  the host sends or what a UI receives.
- **Byte identity.** After any change to `src/runtime` or `lib/build.mjs`,
  rebuild every calculator in the calculators repository with this SDK and with
  the calculators builder, and compare release IDs (docs/VERIFICATION.md). A
  difference must be intended and recorded.
- **Workflows.** Pin every action to a full commit SHA with a `# vX.Y.Z`
  comment. Grant `id-token: write` only to the job that assumes a role. Install
  with `npm ci --ignore-scripts` on any runner that will hold credentials.
  The publish workflow must never take or pass secrets.
- **Public repository.** This repository and package are public. Never commit
  credentials, AWS account IDs, bucket names, role ARNs, internal hostnames
  beyond the public API, or client data. Client names appear only in examples
  that are already public.
- **Versions.** Every user-visible change gets a changeset (`npx changeset`).
  Breaking changes are majors, with the required platform change named.
- **No client code.** Nothing specific to one client belongs here. Client
  behaviour lives in that client's repository; platform behaviour in the
  Illustrata monorepo.

## Verification

```bash
npm run ci          # typecheck, build, tests (including a real Tailwind fixture build and smoke test)
npm pack --dry-run  # package contents
```
