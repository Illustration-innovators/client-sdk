# Preparing a client UI for annotation reviews

A review shows the actual immutable client release with synthetic products,
responses and repeatable UI states. Review links, access controls, comments,
version rounds, screenshots and exports belong to the platform. The client UI
owns stable element identities, synthetic fixtures and state restoration.

This is an optional authoring contract for platforms that support Hosted Tool
synthetic UI reviews. Confirm that support with the platform maintainer before
creating a review. Installing this SDK does not enable it in a portal, and this
guide does not change the release manifest or runtime contract version.

## What a reviewer can access

The review link has its own access rules, independent of the Hosted Tool's
public, SAML or internal access mode. A reviewer does not need the tool's login;
the review does not grant that login or expose its sessions, saved cases or
credentials. The platform may password-protect, expire or revoke the link.

Synthetic review responses are fixed UI examples, not verified calculations.
Label them as synthetic. Keep real customer data, API keys, session tokens,
launch claims and live endpoint URLs out of fixtures and captured state. The
platform's synthetic frame disables network connections and does not perform
real calculations, case writes, application submissions or integration events.
Test live authentication and integration behavior separately.

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

## 2. Export a versioned synthetic fixture

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

## 3. Implement a synthetic-only state bridge

A screen key alone cannot restore product choice, variant, input values, open
dialogs or results. The review host identifies synthetic mode by setting:

```ts
document.documentElement.dataset.illustrataReviewRuntime = "synthetic-v1";
```

This marker selects review behavior; it is not an authorization credential.
Install review listeners only in that mode. Give the application's state root
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
Guard automatic prefetch/autosave effects in synthetic mode as needed. Explicit
reviewer actions may request the platform's canned responses. Unknown or
unavailable targets should be reported as unavailable rather than highlighted
at old coordinates.

The platform stores state with a comment and may restore it after changing
viewport or even when the screen key already matches. Do not assume navigation
always means a new screen or a fresh mount.

## 4. Verify the actual release

Keep a client-owned `docs/UI_REVIEWS.md` with the fixture command, scenarios,
marker conventions, state version, unsupported surfaces and verification steps.
Before calling the UI review-ready:

1. Run the repository's CI, export its fixture, build its independent release,
   and run `npx illustrata-check release` with representative product fixtures.
2. In the platform review workspace, browse -> select a field -> comment ->
   change product/variant/state -> reopen the comment. Confirm the same target
   and original state return. Include controls with repeated labels and dialogs.
3. Repeat at desktop, tablet and mobile widths. Changing viewport must preserve
   the current synthetic state; reopening a comment must restore its viewport.
4. Scroll continuously with the pointer over the preview, and separately over
   the comment rail. Check both directions, trackpad/wheel behavior, long result
   tables, bottom reachability, fit/zoom and resize while scrolled. The preview
   must not stall, jump backward or move the comment rail. Test nested scrollable
   controls without replacing their native scroll behavior.
5. Confirm state restoration causes no calculation or save calls; ordinary
   non-review delivery installs no review listeners. Verify all fixture data is
   synthetic and auth/session-dependent screens are explicitly scoped.
6. Save screenshots and walkthrough evidence with the PR. Review links are for
   feedback, not production activation or release approval.

The starter repository includes this authoring checklist in its documentation;
it does not generate product scenarios, a state bridge or portal review links.
Those must be implemented and verified for the client UI. Updates to shared
agent guidance arrive through an SDK release and `illustrata-sdk upgrade`/`sync`,
not by manually changing generated sections in a client repository.
