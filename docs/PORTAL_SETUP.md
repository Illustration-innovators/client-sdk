# Portal setup for a client UI

How a client's products and tools are configured in the Illustrata admin
portal so its UI release can run. All of this is configuration, not code.

## 1. Client

The client's key in the portal must equal `clientKey` in the UI repository's
`calculator.manifest.json`, and the release name starts with it
(`<clientKey>--<tool>`).

## 2. Products

One product per illustrated product, under that client:

- **Product type:** one listed in the manifest's `compatibleProductTypes`
  (today usually `illustration-demo`).
- **Coherent connection:** the client's Spark connection. Credentials stay in
  the platform.
- **Endpoints:** one per role the manifest's `endpointRoles` declares, and
  release activation checks that each exists on every linked product. The
  roles map to the admin's product fields like this:

  | Manifest role | Admin field | Used when the UI calls |
  | --- | --- | --- |
  | `primary` (also `default`, `illustration`, `calculation`) | PDF Endpoint URL (required) | `runtime.calculate(slug, inputs)` with no `endpoint` |
  | `pdf` (also `secondary`) | Calculation Endpoint URL (optional) | `{ endpoint: "pdf" }` |
  | `rates` | Rates Endpoint URL (optional) | `{ endpoint: "rates" }` |

  Most UIs declare only `primary`. Declare another role only if the UI calls
  it.

## 3. Variants

One per contract option. Each has a display name, display order, Spark
product code, allowed states and a **kind** (`myga`, `fia-accum`, `fia-bonus`,
`fia-glwb`, `spia`, `dia`). UIs built on `@illustrata/client-sdk/products`
pick the product module from the kinds (or an explicit product profile) and
show a configuration error when nothing fits; they never guess.

## 4. Mappings

Input mappings translate the keys the UI sends into Spark input names. The UI
repository lists its payload keys per product; the person configuring mappings
and the UI owner agree on them before the first staging test. Output mappings
shape the JSON the UI's results read.

## 5. Delivery

- **Embed** (script or iframe on a website): link the products, set allowed
  domains and the theme.
- **Hosted Tool** (a page Illustrata hosts): link the products, choose the
  access mode and theme. A UI that requires `staff-workspace-v1` runs only on
  an internal Hosted Tool today.

## 6. Release selection

Releases appear in the global tool catalog under their release name once
registered. Under **Tools > Calculator Releases**, choose the client, the
tool, the staging targets, review and activate. Test. Approve. A production
Admin then imports the approval and deploys.

## Checklist before the first staging test

- [ ] Client key matches the manifest
- [ ] Products exist with every declared endpoint role
- [ ] Every variant has a kind the UI supports
- [ ] Input mappings cover the UI's payload keys
- [ ] A test embed or Hosted Tool links the products and has a theme
- [ ] The release is registered and selected for that target
- [ ] Someone has run it end to end and opened the PDF
