# Host contract

What a client UI receives from the Illustrata host, and what it may do. This
is runtime contract version 1.

## How a release runs

1. A page (or Illustrata Hosted Tool) loads the stable Illustrata loader with a
   credential: an embed token, a frame session or a Hosted Tool slug.
2. The loader asks the platform which release is selected for that credential
   and loads its `widget.js`, checked against its SHA-384 integrity.
3. The runtime inside `widget.js` fetches the tool's config (products, theme,
   optional launch context, user and workspace), checks the release name
   matches, creates an open Shadow DOM, applies the theme as CSS variables and
   renders `Calculator` with a `runtime` prop.

## What the UI exports

`src/index.ts` (or the `entry` in `illustrata.config.ts`) exports:

- `Calculator`: a React component taking `{ runtime, host }`.
- `CALCULATOR_CSS`: one string with every style the UI needs.

## What the UI receives: `runtime`

```ts
interface IllustrataCalculatorRuntime {
  products: CalculatorProduct[];             // the products linked in the portal
  launchContext?: Record<string, unknown> | null; // secure launches only
  workspace?: CalculatorWorkspace;           // saved cases, when the tool provides them
  calculate<T>(productSlug: string, inputs: Record<string, unknown>,
               options?: { endpoint?: string; format?: "json" | "pdf" | "both"; signal?: AbortSignal }): Promise<T>;
  reportError(error: unknown, context?: Record<string, unknown>): void;
}
```

Types: `@illustrata/client-sdk/contract`.

- `calculate` posts the inputs to the product's endpoint on the platform. The
  platform applies the product's input mappings, calls Spark, maps outputs and,
  for PDF formats, merges PDFs. The UI never sees Spark or its credentials.
- `endpoint` names a role configured on the product in the portal. Without
  it, the call uses the product's main endpoint (role `primary`, the admin's
  "PDF Endpoint URL"). A role the manifest does not declare will not be
  configured. PORTAL_SETUP.md maps roles to admin fields.
- `workspace` exists only when the tool's access mode supplies it:
  - Internal Hosted Tools opened by Illustrata staff: `persistence: "server"`,
    the signed-in staff user, cases saved on the platform.
  - Public Hosted Tools: `persistence: "browser"`, user `Guest`. Cases live in
    the visitor's browser tab only; a refresh or new tab starts empty and
    nothing reaches the platform. List, search, filters, sorting and the
    dashboard columns behave as on the server.
  - Embeds and SAML Hosted Tools: none.

  `requiredCapabilities` in the manifest restricts where a UI may be selected:
  `workspace-v1` allows public and internal Hosted Tools, `staff-workspace-v1`
  internal ones only. A later release may change `staff-workspace-v1` to
  `workspace-v1` under the same name; no other capability change is allowed.

## Theme

The host sets these on the Shadow DOM host element when the portal theme has
them; they inherit into the shadow tree:

`--illustrata-accent`, `--illustrata-accent-font`, `--illustrata-button`,
`--illustrata-button-font`, `--illustrata-hover`, `--illustrata-hover-font`,
`--illustrata-base`, `--illustrata-base-font`, `--illustrata-secondary`,
`--illustrata-secondary-font`, `--illustrata-eyebrow`,
`--illustrata-font-heading`, `--illustrata-font-body`.

Fonts are loaded by the host from Google Fonts. A UI must look right when none
of these are set.

## What the UI must not do

- Call the platform directly, build platform URLs, or read, store or log
  credentials.
- Write outside its Shadow DOM: no `document.head`, global styles, or changes
  to the host page.
- Fetch scripts, styles, fonts or images at runtime. Everything is inlined in
  the one bundle.
- Assume a delivery mode: the same release can run in an embed, an iframe or a
  Hosted Tool unless its manifest restricts it.


## Synthetic UI review frames

A platform supporting Hosted Tool UI reviews can run the same immutable release
against frozen synthetic config and responses. It supplies no live Hosted Tool
credential, launch identity or cases. This optional frame mode does not change
`IllustrataCalculatorRuntime` or the release manifest; see
[UI_REVIEWS.md](UI_REVIEWS.md) for the separate DOM marker/state event contract,
fixture bounds and required checks. The SDK runtime/build output is unchanged
by this documentation. Confirm platform support before using the review flow.
