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
- A Hosted Tool UI must work in every access mode its manifest allows. A UI
  with saved cases or a dashboard declares `workspace-v1` (public and internal
  Hosted Tools) unless it truly needs cases saved on the platform
  (`staff-workspace-v1`, internal only). Check `runtime.workspace.persistence`:
  `"browser"` means a public visitor whose cases live in this tab only, so say
  that in the UI. Never build your own storage (localStorage, IndexedDB,
  cookies) for cases.
- Build settings that vary (Tailwind, PostCSS) live in `illustrata.config.ts`
  and nowhere else. Do not add `@vitejs/plugin-react` there; the builder adds it.

### UI review authoring

- For a new or substantially changed Hosted Tool UI, read the installed SDK's
  `docs/UI_REVIEWS.md` and maintain a client-owned `docs/UI_REVIEWS.md` checklist.
  Confirm platform synthetic-review support; the scaffold alone is not ready.
- Keep stable screen/navigation keys and explicit leaf-control review targets.
  Do not derive identity from display copy, user data, generated IDs or mutable
  ordering. Cover every supported product/variant and conditional state.
- Supply a repository-owned synthetic fixture exporter and a versioned,
  synthetic-only state capture/restore bridge. Never put credentials, real
  cases or live launch/session context in fixtures or captured state.
- Restoring a review state must not calculate, autosave, submit or emit events.
  Keep ordinary delivery unchanged. UI review access is separate from tool
  authentication and does not grant access to private sessions or cases.
- Verify select/comment/reopen against the actual built release, including
  dialogs, repeated controls, viewport changes and continuous preview scrolling
  in both directions at desktop/tablet/mobile sizes. Record unsupported screens
  explicitly; do not describe fixture output as a verified calculation.

### Release identity

- `calculator.manifest.json` names the release (`embedType`,
  `<clientKey>--<tool>`) and its contract: client key, product binding,
  compatible product types, delivery modes and required capabilities.
- The first release under a name fixes that contract permanently. Changing any
  of those fields needs a new name (`<clientKey>--<tool>-v2`); the one
  exception is changing `staff-workspace-v1` to `workspace-v1`. A demo or pilot
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

For visual changes, check them with `npm run dev`. If the repository's CI calls
`pr-screenshots.yml`, the pull request run attaches phone and desktop
screenshots of the built release; otherwise attach your own.

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
