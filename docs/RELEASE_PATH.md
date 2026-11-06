# Release path

From a merged change to a client's live tool, and who does each step.

| Step | Who | What happens |
| --- | --- | --- |
| Merge to `main` | Anyone with write access, after green CI | Manifest, workflow and build-config changes need a code-owner review |
| Verify | `publish-release.yml` | `npm run ci`, `illustrata-check sync --strict` |
| Build | `publish-release.yml` | `illustrata-release build --require-publication`, then the release smoke test. No AWS access. |
| Publish | `publish-release.yml`, environment `staging-candidates` | The repository's own AWS role uploads to `widget/releases/<embedType>/<releaseId>/` in the staging bucket. Write-once; `release.json` last. The role can write only that repository's release names. |
| Register | Illustrata platform | The registrar verifies every byte and checksum and lists the release in the admin portal's tool catalog. Nothing is activated. |
| Staging | Illustrata admin with staging release rights | Selects the release for the client's staging test tools, tests it, approves it |
| Production | Illustrata Admin | Imports the staging approval, approves, deploys. The platform copies the exact bytes to production. |
| Rollback | Illustrata Admin | Restores the previous release through the same approval flow. Before a tool has a previous release, disable its Hosted Tool. |

## Release identity

- The release name (`embedType`) is `<clientKey>--<tool>` and permanent. The
  first release under a name fixes its contract: client key, calculator key,
  runtime contract version, product binding, product contract keys,
  compatible product types, delivery modes and required capabilities. A later
  release that changes any of them is refused; use a new name
  (`<clientKey>--<tool>-v2`).
- The release ID is the SHA-256 of the file inventory. Identical bytes give the
  same release, and republishing them changes nothing.
- `release.json` records the first commit that published those bytes. A later
  commit producing identical bytes keeps the original provenance.

## What a client repository cannot do

Choose where a release is served from, overwrite or delete a release, write
another client's release names, publish a server-side module (unless its role
allows it), activate a release, skip approval, or touch production.
