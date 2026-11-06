## Illustrata platform rules (shared by every client UI repository)

This section is maintained in `@illustrata/client-sdk` (`docs/AGENTS_SHARED.md`)
and copied here by `npx illustrata-sdk sync`. Do not edit it in this
repository; CI fails when it drifts from the installed SDK.

### What this repository is

A client UI plug-in for the Illustrata platform. It builds into one browser
bundle that the platform verifies, lets an admin select for an embed or Hosted
Tool, and mounts for end users. The platform hands the bundle a `runtime`; the
bundle renders products and calls the platform only through that runtime.

| This repository owns | The Illustrata platform owns |
| --- | --- |
| Screens, layout, brand, copy | Clients, products, variants, Spark connections, mappings |
| Product rules: fields, validation, payloads, results | API keys, embed tokens, allowed domains |
| Its own tests, preview and design docs | SSO, sessions, saved cases, PDFs, logs |
| | Hosting, release verification, selection, approval, rollback |

A task that needs anything in the right-hand column is platform work in the
Illustrata monorepo. Do not approximate it here. Describe it under "Platform
follow-ups" in the pull request and stop at the boundary.

### Host contract

- `src/index.ts` exports `Calculator` and `CALCULATOR_CSS`. Renaming either
  breaks the release build.
- `Calculator` receives `runtime` (types in `@illustrata/client-sdk/contract`).
  Read products from `runtime.products`, call the platform only through
  `runtime.calculate`, report failures through `runtime.reportError`. Never
  `fetch` the platform directly, build API URLs, or read or store tokens.
- The bundle runs inside a Shadow DOM. All styling goes through
  `CALCULATOR_CSS`. Do not touch `document.head`, global styles or the host
  page. Fonts come from the portal theme.
- Branding arrives as `--illustrata-*` CSS variables on the host element. A
  design must work when the host supplies none.
- `launchContext`, `hostedToolUser` and `workspace` are optional. Treat them as
  absent unless the delivery mode provides them.
- Build settings that vary (Tailwind, PostCSS) live in `illustrata.config.ts`
  and nowhere else. Do not add `@vitejs/plugin-react` there; the builder adds it.

### Release identity

- `calculator.manifest.json` names the release (`embedType`,
  `<clientKey>--<tool>`) and its contract: client key, product binding,
  compatible product types, delivery modes and required capabilities.
- The first release under a name fixes that contract permanently. Changing any
  of those fields needs a new name (`<clientKey>--<tool>-v2`). A demo or pilot
  gets its own name. Changes to the manifest need a code-owner review.
- `publication.independent: true` lets a merge to `main` publish a release to
  staging. Publishing never activates anything: a person selects, tests and
  approves each release in the admin portal.

### Before opening a pull request

```bash
npm run ci
npx illustrata-release build
npx illustrata-check release
```

For visual changes, run `npm run dev` and attach screenshots.

### Secrets

Never commit credentials, API keys, tokens or real environment URLs. The local
staging test key lives only in the git-ignored `.env.local`
(`ILLUSTRATA_STAGING_API_KEY`). `VITE_*` variables are visible in the browser
and are not for secrets.

### Updating the SDK

```bash
npx illustrata-sdk upgrade <version>
```

That installs the exact version and updates the publish workflow reference
and this section together.
