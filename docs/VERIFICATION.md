# Verification

Evidence that this SDK reproduces the calculators repository's releases. Rerun
after any change to `src/runtime` or `lib/build.mjs`.

## 2026-11-06, SDK 0.1.0

**Sources:** calculators `main` at `3c81124` (2026-11-04), with its locked
dependencies (Vite 7.3.6, `@vitejs/plugin-react` 4.7.0, React 18.3.1).

**Method.** In a clean clone of the calculators repository:

1. Built every calculator with its own builder:
   `node scripts/build-widget.mjs <client>/<calculator>`.
2. Installed this SDK from `npm pack` and built the same calculators with
   `npx illustrata-release build --dir clients/<client>/calculators/<name> --no-version-stamp`.
   PathWay GLWB used an `illustrata.config.mjs` with
   `buildQuery: { from: "widget/runtime-query.mjs", export: "buildPathwayGlwbQuery" }`
   in place of the old hard-coded case.
3. Compared release IDs (the SHA-256 of the full file inventory, so equal IDs
   mean every file is byte-identical).
4. Repeated step 2 with `NODE_ENV=development` set.

**Result:**

| Run | Identical release IDs |
| --- | --- |
| `NODE_ENV` unset | 16 of 16 |
| `NODE_ENV=development` | 16 of 16 |

Covered: standalone tools, product-backed tools, the staff-workspace dashboard,
PathWay GLWB's query builder, a server Calculator API module (Knighthead GLWB),
and the four older names without a client prefix.

**Smoke test.** `illustrata-check release` passed on all 16 releases. PathWay
GLWB warns that `CALCULATOR_CSS` is empty, which is intended for that
calculator.

**Tailwind repository.** The Mutual of Omaha UI built through the SDK with an
`illustrata.config.ts` containing its Tailwind and PostCSS settings includes
its compiled utilities and the Shadow DOM fallback. Built without the config,
as the calculators builder would, the bundle contains the raw
`@tailwind utilities` directive and none of its utility classes. The release
smoke test passed on the configured build.

**Runtime drift.** `illustrata-check drift` against the calculators
`tooling/widget-runtime`: no drift (9 files).

**Found and fixed during verification.** With `NODE_ENV` set to anything other
than `production` (a test runner or a developer shell), the React plugin
compiled development JSX that production React cannot run. The builder now
forces production mode; with `NODE_ENV` unset this is what Vite already did,
so release bytes are unchanged (table above). The calculators builder has the
same latent issue.
