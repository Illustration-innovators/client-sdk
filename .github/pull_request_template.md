## What changed

<!-- One or two sentences. -->

## Which part

- [ ] Runtime (`src/runtime`): compiled into every release. Changes release bytes for every repository that upgrades.
- [ ] Release format or publisher (`lib/release.mjs`, `lib/descriptor.mjs`, `lib/publish.mjs`): must match the platform registrar.
- [ ] Builder (`lib/build.mjs`)
- [ ] Checks, preview, products helpers, CLI
- [ ] Workflows (`.github/workflows`)
- [ ] Docs

## Compatibility

- [ ] `npm run ci` passes
- [ ] A changeset describes the change (`npx changeset`)
- [ ] For runtime, builder or release-format changes: rebuilt every calculator in the calculators repository with this SDK and compared release IDs (docs/VERIFICATION.md). Result:
- [ ] Platform change needed first? Name it, or "none".
