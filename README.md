# @illustrata/client-sdk

Tools for building client UIs that run on the Illustrata platform: the runtime
every release ships with, the release builder and publisher, the contract
types, local preview with live staging results, and the checks that keep a
client repository safe to change.

A client UI repository (for example `mutualofomaha-ui`) installs this package,
builds its UI into one self-contained bundle, and publishes it to Illustrata's
staging release bucket. An Illustrata admin then selects, tests and approves
the release in the admin portal. Nothing here can activate a release or reach
production.

## Install

```bash
npm install --save-dev --save-exact @illustrata/client-sdk
```

It installs from the public npm registry with no token. React 18, Vite 7 and
`@vitejs/plugin-react` 4 are peer dependencies: the client repository provides
them.

## Commands

| Command | What it does |
| --- | --- |
| `illustrata-release validate` | Checks `calculator.manifest.json` and `illustrata.config.ts` against the platform's rules |
| `illustrata-release build` | Builds `widget.js`, `assets/calculator.json` and `release.json` under `dist/widget-releases/<embedType>/<releaseId>/` |
| `illustrata-release publish` | Uploads one built release to the staging bucket, write-once, `release.json` last (CI only) |
| `illustrata-check release` | Builds the release and mounts it in a simulated browser: Shadow DOM, stylesheet, no uncaught errors |
| `create-client-ui <clientKey>` | Writes a new client UI repository pinned to this SDK version: `npx -p @illustrata/client-sdk create-client-ui acme` |
| `illustrata-check screenshots` | Builds the release and saves a full-page PNG per product at phone and desktop width in Chromium (needs `playwright` as a dev dependency) |
| `illustrata-check boundaries` | Import rules: the template never imports a product, products never import each other |
| `illustrata-check removal <product>` | Deletes a product module and proves the UI still typechecks, tests and builds |
| `illustrata-check sync` | The SDK workflow references and AGENTS.md shared section match the installed SDK |
| `illustrata-check drift <dir>` | The SDK runtime matches another copy of it (the calculators repository's, until it migrates) |
| `illustrata-sdk upgrade <version>` | Installs an exact SDK version and updates the workflow reference and AGENTS.md together |
| `illustrata-sdk sync` | Rewrites the workflow reference and AGENTS.md shared section to the installed version |

## Package entry points

| Import | For |
| --- | --- |
| `@illustrata/client-sdk/contract` | `IllustrataCalculatorRuntime`, manifest and workspace types |
| `@illustrata/client-sdk/products` | Variant kinds, product parsing and module resolution that fails closed |
| `@illustrata/client-sdk/config` | `defineIllustrataConfig` for `illustrata.config.ts` |
| `@illustrata/client-sdk/postcss` | `shadowPropertyFallback()`, needed for Tailwind v4 inside a Shadow DOM |
| `@illustrata/client-sdk/preview` | `mountPreview`, `StagingPreview`, `createLiveRuntime` for the local preview page |
| `@illustrata/client-sdk/preview/bridge` | `illustrataDevelopmentBridge()` Vite plugin that sends preview calculations to staging |

The runtime itself (`src/runtime`) is not imported by client code. The builder
compiles it into every release.

## Setting up a client repository

See [docs/CLIENT_REPO_SETUP.md](docs/CLIENT_REPO_SETUP.md). In short: an
`illustrata.config.ts` with the repository's build plugins, a ten-line release
workflow that calls this repository's
[`publish-release.yml`](.github/workflows/publish-release.yml), a GitHub
environment and variables, a ruleset on `main`, and the shared AGENTS.md
section from `npx illustrata-sdk sync`.

## Guarantees

- **Same bytes as the calculators repository.** For identical sources the
  builder produces byte-identical releases to the calculators repository's own
  builder. Checked on all 16 calculators: [docs/VERIFICATION.md](docs/VERIFICATION.md).
- **Same release format the platform verifies.** `release.json`, the
  descriptor and the inventory are unchanged from the platform's runtime
  contract version 1.
- **Every release says which SDK built it.** `widget.js` starts with
  `/*! @illustrata/client-sdk <version> */`.

## Versioning

Semantic versions, managed with Changesets (`npx changeset`). A major version
means a runtime contract change or a change that needs a newer platform; its
changelog entry says which platform change must ship first. Any runtime or
builder change changes release bytes for repositories that upgrade, so client
repositories pin an exact version and upgrade deliberately.

## Docs

| File | Covers |
| --- | --- |
| [docs/HOST_CONTRACT.md](docs/HOST_CONTRACT.md) | What a client UI receives from the host and may do |
| [docs/RELEASE_PATH.md](docs/RELEASE_PATH.md) | From merge to production, and who does what |
| [docs/PORTAL_SETUP.md](docs/PORTAL_SETUP.md) | Configuring a client's products and tools in the admin portal |
| [docs/CLIENT_REPO_SETUP.md](docs/CLIENT_REPO_SETUP.md) | Setting up or converting a client UI repository |
| [docs/AGENTS_SHARED.md](docs/AGENTS_SHARED.md) | The shared section every client repository's AGENTS.md carries |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Evidence that the builder matches the calculators repository byte for byte |
| [AGENTS.md](AGENTS.md) | Rules for changing this repository |
