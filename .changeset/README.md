# Changesets

Every user-visible change to the SDK needs a changeset:

```bash
npx changeset
```

Pick the bump: patch for fixes, minor for additions, major for a runtime
contract change or anything that needs a newer platform. Name the platform
change in the summary when one is needed.

To release: `npm run version-packages`, commit, tag `v<version>`, push the tag.
The `Publish SDK to npm` workflow publishes it.
