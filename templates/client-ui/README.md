# __CLIENT_NAME__ client UI

A client UI for Illustrata Link, built and published with
[`@illustrata/client-sdk`](https://github.com/Illustration-innovators/client-sdk).

```bash
npm install
npm run dev          # local preview at http://localhost:5174 with demo products
npm run ci           # typecheck, boundaries, manifest, tests, build
npm run screenshots  # PNGs of the built release (npx playwright install chromium first)
```

Release name: `__CLIENT_KEY__--__TOOL__`. Merges to `main` publish a release to
Illustrata staging once `ILLUSTRATA_PUBLISH_ENABLED` is `true`; publishing never
activates anything. Read `AGENTS.md` before changing the repository and
`docs/ADDING_A_PRODUCT.md` before adding a product.
