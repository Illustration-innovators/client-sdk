# @illustrata/client-sdk

## 0.1.1

- First release published by the `Publish SDK to npm` workflow through npm
  trusted publishing (OIDC, no token), with provenance. No code changes from
  0.1.0.
- The publish workflow skips a version that is already on npm, so pushing the
  tag of a hand-published version is harmless.

## 0.1.0

First release, extracted from the Illustrata calculators repository
(`main`, 2026-11-04) and the Mutual of Omaha client UI repository.

- Runtime, contract types, release format and publisher ported unchanged.
- Builder reads a tool directory instead of the calculators workspace layout,
  applies the repository's own Vite plugins and CSS options from
  `illustrata.config.ts`, replaces the PathWay special case with a
  `buildQuery` config hook, forces production mode regardless of `NODE_ENV`,
  and stamps each `widget.js` with the SDK version.
- Byte-identical releases to the calculators builder for all 16 calculators
  (docs/VERIFICATION.md).
- Checks: import boundaries, product removal, release smoke test in a
  simulated browser, workflow and AGENTS.md sync, runtime drift.
- Preview: Shadow DOM mount helper, staging bridge and staging preview panel,
  Tailwind Shadow DOM PostCSS fallback, product parsing and module resolution.
- Reusable `publish-release.yml` workflow and `illustrata-sdk upgrade`.
