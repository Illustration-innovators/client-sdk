# UI review readiness

This starter is not annotation-review ready yet. Read the installed SDK's
`node_modules/@illustrata/client-sdk/docs/UI_REVIEWS.md` before implementing it.
Confirm platform staging live Hosted Tool review support.

Before sharing a review:

- Create a Hosted Tool, connect products and explicitly select its published UI
  release. Publication alone does not activate a build.
- Add stable active-screen/navigation markers and explicit leaf-control targets.
- Implement the versioned `hosted-live-v1` review state bridge. Restoration must
  not calculate, autosave, submit or emit integration events.
- Compare real calculation and PDF results with ordinary tool access for the
  same inputs/configuration. Live reviews need no synthetic fixture upload.
- Test comment/reopen after product, variant, dialog and viewport changes.
- Verify desktop/tablet/mobile scrolling, fit/zoom and nested controls.
- Identify unsupported workspace/integration surfaces; never borrow real staff
  or agent sessions/cases. Normal access mode does not need to become public.

Maintain a client guide with setup, state version, markers, supported screens and
verification. New rounds use the build selected on the tool; prior rounds remain
pinned. This scaffold does not implement the state bridge or create review links.
