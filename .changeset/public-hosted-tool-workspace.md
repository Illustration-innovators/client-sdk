---
"@illustrata/client-sdk": minor
---

Public Hosted Tools get a browser-only workspace. When the platform sends
`browserWorkspace` (public Hosted Tools), the runtime supplies
`runtime.workspace` with `persistence: "browser"` and a `Guest` user: cases live
in the visitor's tab only and match the server workspace's list, search,
filters, sorting and dashboard columns. The server workspace now reports
`persistence: "server"`. Manifests may declare the new `workspace-v1`
capability (public or internal Hosted Tools). Needs the Illustrata platform
release that accepts `workspace-v1` and sends `browserWorkspace` before any
release declaring it is published.
