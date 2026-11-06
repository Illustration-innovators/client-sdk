# Adding a product

A product module holds everything specific to one kind of product. The
template picks one per portal product from its variant kinds, or from an
explicit product profile set in the portal.

1. Copy `src/products/example/` to `src/products/<name>/` and rename the
   export (`<name>Module`) and its `key`.
2. Set `supportedKinds` to the variant kinds it handles (`myga`, `fia-accum`,
   `fia-bonus`, `fia-glwb`, `spia`, `dia`). If two modules support the same
   kinds, the portal must set a product profile naming the module's `key`.
3. Build its `Screen`: inputs, validation, the payload sent with
   `runtime.calculate(product.slug, inputs)`, and the results.
4. Add one line to `src/products/registry.ts`, ending in
   `// products/<name>`, and its import on its own line.
5. Add the product to `tests/fixtures/products.json` so the preview, tests
   and screenshots cover it.
6. Run `npm run ci` and `npx illustrata-check removal <name>`.

Delete `src/products/example/` (and its registry line) once a real product
replaces it.
