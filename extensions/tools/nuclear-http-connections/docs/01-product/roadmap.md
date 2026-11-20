---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../02-architecture/overview.md, ../../../../vscode/docs/01-product/roadmap.md, ../../../../jetbrains/docs/01-product/roadmap.md]
---
# Roadmap of HTTP Connections

## Untested

- **Its texts in Spanish** (spec 011, T4.2) and its settings section: written and compiled, never seen in a
  running VS Code in Spanish.
- The HTTP Connections workspace in a running VS Code: the tree, also with projects opened as tabs; the component tabs; a
  request sent; the panels restored after a switch of workspace; *Update* of a contract; the environments.
- The request page of 2026-11-20 (header rows, body editor, auth, OAuth 2.0, rules, automatic tokens, JSON tree,
  HTML preview, variables drawer) in a running VS Code: its logic is tested without the editor and the page was
  rendered in a headless browser with sample data, never in a webview nor against a real backend or token server.
- The WebSocket panel in a running VS Code: tested without the editor (a real socket against an echo server, the
  page rendered in a headless browser with sample data); its socket was tried by hand against the backend example
  `tasks_api` built with fastapi (2026-11-18: the token header, the subscription, a request's answer, the pushed
  event, the refused handshake), never with nestjs.
- The *HTTP Connections* tool window in a running IDE, its socket panel too (only compiled, against Android Studio
  2026.2).

## Pending

- **More protocols**, in this order (the user's plan): HTTP and WebSockets are done; next raw TCP sockets, then gRPC
  (from `.proto` files or server reflection), then UDP. Each needs its contract field (or a document like OpenAPI for
  what is not Nuclear), a tree mark and a panel.
- **The tool's name**: it speaks more than HTTP now; the user decides whether *HTTP Connections* stays.
- **WebSockets in JetBrains**: one socket at a time, a plain-text log (VS Code has a tab per socket and a log of
  rows that open), an event proposes `subscribe` only; English only, like the rest of its window.
- **OAuth 2.0 authorization code with PKCE**: needs the browser (`vscode.env.openExternal`) and a localhost
  callback the extension listens on; only client credentials and password are supported. No automatic refresh of an
  expired token either (*Get token* again).
- **Secret values in the keyring**: a variable marked secret is only masked in the page; its value is still in
  `http.json`. It belongs in VS Code's `SecretStorage`, resolved by the host when it sends.
- **Scoped variables and the new request page in JetBrains**: the tool window reads only the environment's own
  `vars` and `headers` (a scoped file loads there), and has no header rows, auth tab, rules, JSON tree nor variables
  editor. Its `writeEnvironments` keeps the fields it does not know (`projects`, `secrets`), so it never drops what
  VS Code wrote.
- **Big responses**: over 300 kB the body is shown without colors; a JSON tree of thousands of nodes opens only its
  first levels but has no virtual scrolling.
- **Two token guards share `{{token}}`**: a controller with its own token (`Authorization: Bearer`) besides the app's
  proposes both headers with the same variable; the user edits one. A variable per guard needs a name the contract
  does not give.
