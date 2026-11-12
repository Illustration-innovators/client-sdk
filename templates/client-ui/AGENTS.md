# __CLIENT_NAME__ - Agent Operating Instructions

Read this before changing the repository. It applies to people and to coding
agents equally. Keep the client-specific part current; the shared part at the
end is generated from `@illustrata/client-sdk` (`npx illustrata-sdk sync`).

## What this repository is

A client UI for Illustrata Link. It builds into one browser bundle that the
Illustrata platform publishes, verifies, lets an admin select for a Hosted Tool
or embed, and mounts inside a Shadow DOM. The platform hands the bundle a
`runtime`; the bundle renders __CLIENT_NAME__'s products and calls the platform
through that runtime. Nothing else.

| This repository owns | The Illustrata platform owns |
| --- | --- |
| Screens, layout, brand, copy | Clients, products, variants, Spark connections, mappings |
| Product modules: fields, validation, payload, results, styles | Calling Spark, merging PDFs, request logging |
| Module resolution rules (fail closed) | SSO/SAML, sessions, saved cases, document storage |
| Local preview and tests | Hosting, release verification, selection, approval, rollback |

If a task needs something in the right-hand column, it is platform work. Write
it under "Platform follow-ups" in the pull request and stop at the boundary.

## Layout

- `src/template/`: the base every product shares (shell, theme, module
  interface). It never imports a product.
- `src/products/<name>/`: one folder per product module. Products never import
  each other. `src/products/registry.ts` is the only file that lists them.
- `src/Calculator.tsx`: resolves a module for each portal product and renders it.
- `src/demo/`: local preview (`npm run dev`). Never shipped.
- `tests/fixtures/products.json`: demo products used by the preview, tests,
  the release smoke test and CI screenshots.
- `design/handoff/`: design input, not the spec.
- `calculator.manifest.json`: the release identity. Its name, client key and
  contract are permanent once published (client-sdk `docs/RELEASE_PATH.md`).

## Rules

- Style only with Tailwind classes and the tokens in
  `src/template/styles/template.css`. Brand colours come from the portal's
  `--illustrata-*` variables with this client's values as fallbacks.
- A product module declares the variant kinds it supports. Never add a default
  module or guess: an unsupported product shows a configuration error.
- Payload keys a module sends must match the product's input mappings in the
  portal. List new keys under "Platform follow-ups".
- Declare an endpoint role in the manifest only if the UI calls it.

## UI reviews

Read `docs/UI_REVIEWS.md` before implementing review support. The scaffold only
provides a checklist; stable semantic markers and a versioned review-only
state bridge still need implementation. Maintain that document
as screens/products change, and verify the actual release's comment restoration,
viewport changes and scrolling before claiming review readiness.

## Before opening a pull request

```bash
npm run ci
```

CI also runs the release smoke test, a removal check per product module and,
on pull requests, phone and desktop screenshots of the built release.
