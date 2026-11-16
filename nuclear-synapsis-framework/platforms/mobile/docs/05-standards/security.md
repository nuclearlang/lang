---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [02-architecture/runtime.md, 02-architecture/local-database.md, 08-guides/genkit.md]
---
# Security and performance rules

Synapsis must warn when code breaks one of these.

| Topic | Rule |
|---|---|
| Headers | name / value pairs: `headers = { "Accept": "application/json" }` |
| Retries | automatic only on idempotent methods; POST and PATCH only with an explicit `retry` |
| Cache | purged when the session ends |
| WebSocket | `wss://` in production (`ws://` travels unencrypted) |
| Tokens | only `SessionManager` stores them (secure storage); never in annotations or config |
| Logs | mask sensitive data; no debug nor info in release |
| Network | no constant polling: only on connectivity changes and on demand |
| Events | typed (the kind `event`), delivered on demand |

## Sensitive data

| Data | How it is protected |
|---|---|
| The session (data, token, roles, permissions) | the secure storage; it ends after its timeout without activity; an expired token is never sent and a 401 ends the session |
| The local database | encrypted unless a config says otherwise: AES-256 with a key generated once and kept in the secure storage. On web the key lives in the browser's storage, weaker than a phone's keystore ([ADR-mobile-0006](../03-adr/0006-local-database.md)) |
| Logs | `token`, `password`, `authorization`, `secret` and `cookie` are masked; release writes only warn and error |
| The key of an AI provider | a key written in an app can be read by anyone who has the app: for production prefer `FirebaseAI` or a remote flow on a server ([guide](../08-guides/genkit.md)) |

## Access

Access is denied by default. A screen declares its rule in `@screen(loggedIn, acl)` and a use case in `@requires`
and `@acl`; the checks are the runtime's ([runtime.md](../02-architecture/runtime.md)). Privacy between components
is checked by the transpiler, not at run time ([project.md](../02-architecture/project.md)).
