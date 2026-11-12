# Preparing a client UI for annotation reviews

A staging live Hosted Tool review shows the actual immutable client release and
runs real calculations against the tool's configured linked products. The
platform owns review links, access, calculation authorization, comments and
rounds. Client repositories own screens, stable element identities and state
restoration. No release manifest or SDK runtime format change is required.

## Platform prerequisites and access

The platform must support `hosted-live-v1` reviews. Create and configure the
Hosted Tool first, publish its release through the normal independent release
workflow, then explicitly select that release on the staging tool. Publication
and registration do not activate a tool. A review round pins the selected UI
release; publishing a newer build does not change an existing round. Start a new
round after selecting the newer build.

The review link grants a separate staging review capability. It can work with
public, internal or SAML tools without granting a staff account or SAML identity.
Do not change the tool to public. Normal tool authentication remains separate.
The platform may password-protect, expire or revoke the link. Production must
not issue or accept live Hosted Tool review capabilities.

Explicit reviewer actions run real rates, illustrations and generated PDFs using
the configured staging calculation pipeline. A review does not grant existing
agent cases, staff workspaces, application submission or downstream deliveries.
Unsupported surfaces must be identified in the client guide. Never capture
credentials, session tokens or existing case identities in comment state.

UI release pinning does not freeze model versions, rates or product configuration.
A restored result is historical display state, not a new calculation. Run again
to obtain current results and use request IDs when discussing calculation errors.

## 1. Identify screens and elements

Give each active screen a stable, lowercase kebab-case key. Put the matching key
on navigation controls, including mobile navigation. Show only the active
screen marker:

```tsx
<button data-illustrata-review-screen-target="contract">Contract</button>
<section
  data-illustrata-review-screen="contract"
  data-illustrata-review-screen-label="Contract specifications"
>
  <input
    id="deposit"
    data-illustrata-review-target="deposit"
    data-illustrata-review-target-label="Deposit"
  />
</section>
```

Keys describe a semantic role, not display copy, an amount, user-entered data,
random IDs or a CSS selector. Keep keys when labels/layout change. Use distinct
keys for different controls on the active screen; the platform normalizes keys,
so punctuation/case differences must not be used to distinguish them.

Mark the actual interactive leaf, not just a containing card: a nested input,
button, table cell or chart item may take precedence over its parent region.
Also identify meaningful headings, helper/error text, cards, dialogs, charts and
ledger cells where reviewers need separate feedback. Keep dialogs/portals in
the open Shadow DOM. Use `data-illustrata-review-ignore` for review-only controls
that should never be annotation targets.

For repeated items, prefer a stable synthetic item key. If a fixed scenario uses
row positions, restore its exact ordering before resolving a comment and state
that limitation in the client repository's review guide. Never claim that row 2
identifies the same resource after arbitrary insertion or sorting.

## 2. Legacy synthetic fixtures (optional)

New live reviews do not require fixture uploads or canned responses. This
section documents older `synthetic-v1` rounds and optional isolated visual tests.
These examples cannot validate calculation accuracy and must stay labelled.

Add a repository-owned export command, conventionally `npm run review:fixture`,
and document its output path. The SDK does not supply this command automatically.
Use the same product types and modules as the real UI, with synthetic values.
The current platform fixture shape is:

```ts
type ReviewState = { version: 1; data: Record<string, unknown> };
type ReviewFixture = {
  version: 1;
  label: string;
  config: {
    embedType: string; // exactly the release name
    products: CalculatorProduct[];
    colors?: Record<string, string>;
    fonts?: Record<string, unknown>;
  };
  responses: Array<{
    productSlug: string;
    endpoint?: string;
    format?: "json" | "pdf" | "both";
    status?: number;
    body: Record<string, unknown>;
  }>;
  scenarios?: Array<{ key: string; label: string; state: ReviewState }>;
};
```

Import `CalculatorProduct` from `@illustrata/client-sdk/contract` in your exporter.
Products need unique slugs and valid host-shaped variants. Responses must
reference those slugs. Each product/endpoint/format combination must be unique.
Omitted endpoint means the main endpoint; omitted format means JSON. The SDK
transports a `format: "pdf"` calculation as `format=both`, so export a `both`
response for that request. `status` defaults to 200 and must be an integer from
200 through 599 except 204, 205 and 304: every fixture response has a JSON body,
so bodyless HTTP statuses are unsupported. Match the UI's actual requested
endpoint roles and formats, and include a clearly marked placeholder PDF if the
UI needs one.

Current platform bounds are 512 KiB for the fixture and 64 KiB for each state,
measured as UTF-8 JSON bytes. There may be at most 100 products, 100 responses and
30 scenarios. The platform's validator is authoritative; keep exports within
those bounds, and validate against the target platform before sharing. A fixture
is separate input to review creation; do not add it to `calculator.manifest.json`
or change the release inventory/format to carry it.

Cover every supported product and variant branch, plus meaningful conditional,
validation, loading, empty, error and result states. Supply complete inputs for
reachable results, and intentionally incomplete inputs for validation scenarios.
Fixed output numbers do not change when a reviewer edits an input. Document
that distinction from any input-dependent local preview.

The current fixture config does not accept live launch/user/workspace context.
A dashboard or other context-dependent screen needs a reviewed synthetic adapter
supported by the platform before it can be claimed as covered. Do not enable
dormant features, bypass access rules or substitute real cases to fill that gap.

## 3. Implement a review-only state bridge

A screen key alone cannot restore product choice, variant, input values, open
dialogs or results. The review host identifies live review mode by setting:

```ts
document.documentElement.dataset.illustrataReviewRuntime = "hosted-live-v1";
```

This marker selects review behavior; it is not an authorization credential.
Install review listeners only for `hosted-live-v1` or legacy `synthetic-v1`. Give the application's state root
`data-illustrata-review-state-root="your-ui-v1"` and implement these DOM events:

| Event | Direction | Contract |
| --- | --- | --- |
| `illustrata-review-capture-state` | Host -> root | Mutable `detail: { state: null }`; synchronously assign a JSON `ReviewState` to `detail.state` |
| `illustrata-review-restore-state` | Host -> root | `detail: { state: ReviewState }`; validate and restore state before highlighting the saved target |
| `illustrata-review-state-ready` | Root -> host | Dispatch after both listeners are installed; set `bubbles: true, composed: true` so the host can observe it outside Shadow DOM |

Capture the minimum state that reproduces the visible UI: selected products and
variants, inputs, wizard progress, conditional choices, dialog and result/error
state. Serialize plain JSON, not DOM nodes, functions, credentials or case IDs.
Validate version, size, products, variants, step bounds and state shapes before
restoring. Valid incomplete selections must remain restorable, including a
product whose required option has not yet been chosen.

Restore React/application state directly. Cancel or invalidate pending requests
so an old response cannot overwrite the restored state. Restoration must not run
a calculation, autosave, submit an application or emit an integration event.
Guard automatic prefetch/autosave effects during restoration as needed. Explicit
reviewer actions use real calculations in live mode and canned data in legacy
synthetic mode. Never infer authorization from this DOM marker. Unknown or
unavailable targets should be reported as unavailable rather than highlighted
at old coordinates.

The platform stores state with a comment and may restore it after changing
viewport or even when the screen key already matches. Do not assume navigation
always means a new screen or a fresh mount.

## 4. Verify the actual release

Keep a client-owned `docs/UI_REVIEWS.md` with live-review setup, supported screens,
marker conventions, state version, unsupported surfaces and verification steps.
Before calling the UI review-ready:

1. Run the repository's CI, build its independent release,
   and run `npx illustrata-check release` with representative product fixtures.
2. In the platform review workspace, browse -> select a field -> comment ->
   change product/variant/state -> reopen the comment. Confirm the same target
   and original state return. Include controls with repeated labels and dialogs.
3. Repeat at desktop, tablet and mobile widths. Changing viewport must preserve
   the current review state; reopening a comment must restore its viewport.
4. Scroll continuously with the pointer over the preview, and separately over
   the comment rail. Check both directions, trackpad/wheel behavior, long result
   tables, bottom reachability, fit/zoom and resize while scrolled. The preview
   must not stall, jump backward or move the comment rail. Test nested scrollable
   controls without replacing their native scroll behavior.
5. Confirm state restoration causes no calculation or save calls; ordinary
   non-review delivery installs no review listeners. Compare explicit live runs with ordinary tool calculations using the same
   inputs/configuration. Verify password/expiry/revocation and supported access modes.
6. Save screenshots and walkthrough evidence with the PR. Review links are for
   feedback, not production activation or release approval.

The starter repository includes this authoring checklist in its documentation;
it does not generate product scenarios, a state bridge or portal review links.
Those must be implemented and verified for the client UI. Updates to shared
agent guidance arrive through an SDK release and `illustrata-sdk upgrade`/`sync`,
not by manually changing generated sections in a client repository.
