# Setting up a client UI repository

For a new repository or one converting to the SDK. Steps 1-5 are in the
repository; step 6 is GitHub settings; step 7 is Illustrata's side.

## 1. Install

```bash
npm install --save-dev --save-exact @illustrata/client-sdk
```

`package.json` needs a `ci` script that runs the repository's own checks, for
example:

```json
"scripts": {
  "ci": "npm run check-types && npx illustrata-check boundaries && npm test && npx illustrata-release validate"
}
```

## 2. `illustrata.config.ts`

The one place for build settings that vary by repository. The release builder
reads it; point the repository's own Vite configs at it too.

```ts
import tailwindcss from "@tailwindcss/vite";
import { defineIllustrataConfig } from "@illustrata/client-sdk/config";
import { shadowPropertyFallback } from "@illustrata/client-sdk/postcss";

export default defineIllustrataConfig({
  plugins: [tailwindcss()],
  css: { postcss: { plugins: [shadowPropertyFallback()] } },
});
```

Do not include `@vitejs/plugin-react`; the builder adds it. Example
`vite.preview.config.ts` sharing the same settings and adding the staging
bridge:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { illustrataDevelopmentBridge } from "@illustrata/client-sdk/preview/bridge";
import illustrata from "./illustrata.config";

export default defineConfig({
  root: "src/demo",
  plugins: [react(), ...(illustrata.plugins ?? []), illustrataDevelopmentBridge()],
  css: illustrata.css,
  server: { port: 5174 },
});
```

## 3. Contract types

Replace any vendored copy of the contract with
`@illustrata/client-sdk/contract`, and any local product parsing or module
resolution with `@illustrata/client-sdk/products`.

## 4. Workflows

`.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  release:
    if: vars.ILLUSTRATA_PUBLISH_ENABLED == 'true'
    uses: Illustration-innovators/client-sdk/.github/workflows/publish-release.yml@v0.1.0
    permissions:
      contents: read
      id-token: write
    with:
      role-arn: ${{ vars.ILLUSTRATA_PUBLISH_ROLE_ARN }}
      aws-region: ${{ vars.ILLUSTRATA_AWS_REGION }}
      bucket: ${{ vars.ILLUSTRATA_RELEASE_BUCKET }}
```

The `@v...` tag must equal the installed SDK version; `illustrata-sdk upgrade`
and `illustrata-sdk sync` keep them together, and `illustrata-check sync`
fails CI when they differ.

`.github/workflows/ci.yml` (pull requests): `npm ci --ignore-scripts`,
`npm run ci`, `npx illustrata-check sync --strict`,
`npx illustrata-check release`. Pin every action to a commit SHA, as
`publish-release.yml` does.

## 5. AGENTS.md, CODEOWNERS, `.gitignore`

- Run `npx illustrata-sdk sync` to add the shared platform section to
  AGENTS.md. Keep client-specific rules outside its markers.
- `.github/CODEOWNERS` covering only the files that change a tool's identity,
  trust or build:

  ```
  /calculator.manifest.json   @benrutt99 @ianmartens23
  /illustrata.config.ts       @benrutt99 @ianmartens23
  /.github/                   @benrutt99 @ianmartens23
  /package.json               @benrutt99 @ianmartens23
  ```

- `.gitignore` includes `.env.local` and `dist/`.
- The local staging test key goes in `.env.local` as
  `ILLUSTRATA_STAGING_API_KEY`, never in code.

## 6. GitHub settings

- **Environment** `staging-candidates`, deployments from `main` only.
- **Repository variables:** `ILLUSTRATA_PUBLISH_ENABLED` (`true` once the
  repository should publish), `ILLUSTRATA_PUBLISH_ROLE_ARN` (from Illustrata).
- **Organization variables** (shared): `ILLUSTRATA_AWS_REGION`,
  `ILLUSTRATA_RELEASE_BUCKET`.
- **Ruleset on `main`:** pull request required, the CI check required, code
  owner review required, no force push, no deletion.

## 7. Illustrata platform

An Illustrata maintainer adds the repository to the publisher map in the
monorepo's Terraform (its immutable repository ID and its client keys) and
applies it. That creates the repository's publish role, limited to
`widget/releases/<clientKey>--*`. Until then the publish job is refused by AWS.
