# UI review readiness

This starter is not annotation-review ready yet. Use the installed SDK's
[UI review authoring guide](../node_modules/@illustrata/client-sdk/docs/UI_REVIEWS.md)
(the path from the repository root is
`node_modules/@illustrata/client-sdk/docs/UI_REVIEWS.md`) when implementing it.
Confirm the target platform supports Hosted Tool synthetic reviews first.

Before sharing a review, implement and document:

- Stable active-screen/navigation markers and explicit leaf-control targets.
- A repository-owned `review:fixture` exporter with synthetic products,
  responses and scenarios for every supported product/variant and key UI state.
- A versioned synthetic-only state capture/restore bridge. Restoring must not
  calculate, autosave, submit or emit integration events.
- Tests that reopen comments after changing product, variant, dialog and viewport.
- Desktop/tablet/mobile scroll verification: continuous wheel/trackpad motion,
  fit/zoom, long screens and independent comment-rail scrolling.
- Explicit limits for auth, saved cases or other surfaces needing a separate
  synthetic adapter; never use real credentials or client records in a review.

Record the exporter command/output path, scenario list, state version and marker
conventions here once implemented. Upload the fixture through the platform's
review creation flow and review the actual pinned release, not a separate mock UI.
The SDK scaffold does not create this exporter, state bridge or a review link.
