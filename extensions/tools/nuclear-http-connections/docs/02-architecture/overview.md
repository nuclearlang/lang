---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../01-product/roadmap.md, ../../../../docs/03-adr/0002-the-nuclear-workspace.md, ../../../../vscode/docs/02-architecture/workspace.md]
---
# Architecture of HTTP Connections

A basic Bruno / Postman inside the editor (ADR-extensions-0002) over the contract the compiler writes
(ADR-synapsis-0006), for HTTP and WebSockets. Not run in a VS Code window nor in a running IDE yet
([roadmap](../01-product/roadmap.md)).

## Where the endpoints come from

`.nuclear/contract.json` is written next to the project card `.nuclear/project.json` (by `project::write_metadata`,
so the language server's `Project::build` produces it): the app, its version, platform and dialect, its `models`,
its `controllers` (what a backend exposes) and its `repositories` (what a mobile or web app calls), each a
component with its routes (verb, path, params in path / query / body, what it returns)
([projects §1.2](../../../../../nuclearlang/docs/07-reference/projects.md)).

## The contract it reads for WebSockets

A backend's contract says what its WebSocket serves (ADR-synapsis-0008, ADR-synapsis-0007; the format:
[projects §1.2](../../../../../nuclearlang/docs/07-reference/projects.md)). Each field may be absent, and then the
endpoint is HTTP only (an older contract shows as it did).

| Field | Meaning | What the tool does with it |
|---|---|---|
| `webSocket` | the path of the app's socket (`"/ws"`), or `null` | the socket's url: the base url plus this path; no events without it |
| `controllers.<C>.transports` | `["http"]` or `["http", "websocket"]` | `websocket`: the routes carry the `WS` badge |
| `guards`, `controllers.<C>.guards` | the app's guards, then the controller's: `{"guard": "token", "header": …}`, `{"guard": "noOrigin"}` | each token's header is proposed (`{{token}}`; `Bearer {{token}}` in `Authorization`, the default header) |
| `events.<topic>` | the `component` that publishes it, its `payload` and the map's `fields` | an `EVENT` row under that component |

The frames the panel proposes are the framework's, as drafts the user can edit: a route as
`{ "id": 1, "method": "GET", "path": "/tasks/{id}", "headers": {}, "body": … }` (a full HTTP request through the app,
so its guards and validation answer as over HTTP), an event as `{ "subscribe": "tasks.created" }` and
`{ "unsubscribe": "tasks.created" }`. The app answers `{ "id", "status", "body" }` and pushes
`{ "event": topic, "data" }`.

## The model (`httpConnections.ts`)

`activateHttpConnections(context)` returns the `HttpModel`.

- `findProjects` walks the workspace folders (depth 4, skipping `build`, `node_modules`…) for
  `.nuclear/project.json` and reads the `contract.json` next to it. The model watches `**/.nuclear/*.json`.
- `tree()` gives the `TreeNode`s the workspace's webview draws: platform → project → *Contracts* (with ↓ update
  buttons) / component → endpoint and pushed event; *OpenAPI documents* (with +) from the active environment's
  `openapi` list, grouped by tag; and *WebSockets* (with +) from its `sockets` list.
- A route served over WebSockets carries a `badge` (`WS`): served only there, its `protocol` is `websocket` and it
  opens in the socket panel; served over both, the row opens the HTTP panel and the badge (`open` action) the socket
  panel. An event (`kind: 'event'`, verb `EVENT`) opens the socket panel with its subscription.
  `nuclear.httpConnections.open` picks the panel by `protocol`; `runAction` serves the actions the workspace forwards.
- `declaredContracts(root)`: the contracts an app declares in its `config.nuc`.
- `sampleOf`: a sample body from the contract's model.
- **Environments**: `<first workspace folder>/.nuclear/http.json`, else `globalStorageUri/http.json`. Its shape:
  `active`, and `environments.<name>.{vars, headers, secrets, baseUrls, openapi, sockets, projects}`, where
  `projects.<project>.{vars, headers, secrets, components.<component>.{vars, headers, secrets}}` are the scoped
  variables. `request.ts` reads it (`normalizeEnvironments`: every missing field empty, so an earlier file loads
  unchanged) and writes it (`compactEnvironments`: the empty new fields left out); `saveEnvironments` writes and
  refreshes. `{{var}}` and the headers resolve component > project > environment (`scopedVars`), by the extension
  host. `secrets` only masks a value in the page. `addSocket` adds a ws:// or wss:// url (or one starting with a
  `{{var}}`) to `sockets`.

Commands: `nuclear.httpConnections.{refresh,selectEnvironment,editEnvironments,addOpenApi,open}` and
`nuclear.contracts.update (root?, name?)`, which runs `~/.local/bin/nuclear contracts update` in the project (the
output channel *HTTP Connections*).

## A component's panel (`panel.ts`, `requestScript.ts`, `request.ts`)

`ComponentPanel`: one webview panel per `componentKey(endpoint)` (`<project>::<component>`, which also names the
variables' scopes), like a Bruno folder, with an inner tab per endpoint opened from the tree. The page is plain HTML
and script with a nonce CSP; its script is `requestScript.ts` and its pure helpers `request.ts`'s, inlined by their
source (tested as the page runs them). Each inner tab keeps:

- the method, the url with its path and query parameters (a `{{var}}` preview under it), and the request's panes:
  **Params**; **Headers**, rows `{on, name, value, source?, edited?}`: the auto rows are the guards' (`code`),
  Content-Type of the body (`body`) and each scope's headers (`global`, `project`, `component`), merged on every
  change by `mergeHeaderRows` (a deleted auto row is kept in `removed`, a user row of the same name wins, an edited
  one stays; *Restore defaults*); **Body**, a textarea over its highlighted copy, with the JSON problem's line and
  column and *Format* (`{{var}}` counts as a value); **Auth** (below); **After response**, the rules
  `{on, name, from: body|header, path, scope}`;
- its last response: status badge, time, size, and the views *Pretty* (a JSON tree: open and close, counts, copy a
  value or its path, *Save as variable…*; HTML and XML highlighted), *Raw*, *Preview* (HTML in an `iframe` with an
  empty `sandbox` and `srcdoc`) and *Headers*.

The host:

- **send**: resolves `{{var}}` by scope, applies the auth (`applyAuth`), `fetch` with the `nuclear.http.timeoutSeconds`
  timeout and a cancel; then runs the rules (`runRules`) and, on a 2xx answer, `autoTokenUpdates`: a token field
  (`access_token`, `accessToken`, `token`, `jwt`, `id_token`, `refresh_token`, a few levels deep) fills each token-like
  variable the request used (`{{token}}`). A variable is written where it is already defined, else in the project
  scope; the page shows a notice with *Undo* (the previous values travel with it).
- **Auth**: *Inherit* (the rows as they are), *No auth* (no `Authorization`), *Bearer*, *Basic* (base64 of the
  resolved user and password), *API key* (header or query), *OAuth 2.0* with the client-credentials and password
  grants: *Get token* is the host's `fetch` to the token url (`oauthTokenRequest`; the client by a Basic header or in
  the body), the access token goes into its variable (`accessToken`) and is sent as `Bearer`; the page shows the
  expiry.
- **The variables drawer**: the scopes *Environment*, *Project*, *Component*, each with its variables (secret toggle,
  *overridden by* marks) and headers; each change is an `envEdit` (`editScope`: set, rename, delete, secret) the host
  writes. The environment is picked in the bar; *Edit http.json* opens the file.

The webview posts its whole state (`tabs`, `active`, `layout`, `split`) on every change and the model keeps it in
`memory` by key, so `restore(keys)` rebuilds the panels when the HTTP Connections workspace is entered again
(`model.reopen` = the keys open when it was left); a state of an earlier version (header pairs) is converted by
`migrateForm`. The memory lives in the window, not on disk.

The layout splits the request and the response side by side, stacked, or automatically (stacked under 860 px), with
a draggable, keyboard-moved gutter. `Ctrl/Cmd+Enter` sends, `Alt+Shift+F` formats the body, `Escape` closes the
drawer or the dialog; the tabs move with the arrows. The icons are `icons.ts`'s inline SVG.

## The WebSocket panel (`socketPanel.ts`, `socket.ts`)

`SocketPanel`: one webview panel per component (`ws::<project>::<component>`; the environment's urls share one,
*WebSockets*), with an inner tab per socket url, so the routes and events of a component share their backend's one
socket. Opening a route or an event adds its message to the tab's chips (*from the contract*) and puts it in the
draft. A tab keeps its url, headers, draft, format (JSON or text), the sent messages (newest first, 30) and the log
(the last 500: time, direction, size; a row opens to its pretty, colored JSON; filter by text and direction; clear;
copy).

- The url: the base url of the project or the client's connection from the environment (else `{{baseUrl}}`) plus
  the contract's socket path; `http(s)` becomes `ws(s)` after `{{var}}` is resolved.
- The headers: each token guard's header (the app's, then the controller's) is proposed unless the environment
  already sends it; the environment's headers are sent too, once, at the handshake. A refused handshake (no 101: a
  missing token, an `Origin`, a wrong path) is an error line that says so, since Node gives no reason.
- The socket is the extension host's (`SocketConnection`, Node 22's `WebSocket`, which sends the headers and no
  `Origin`, so the guards that refuse an `Origin` let the tool in). It closes with its inner tab or the editor tab.
  An editor whose Node has no `WebSocket` (before VS Code 1.101) gets an error line in the log.
- The page's log and history functions are `socket.ts`'s, inlined by their source (`appendLog`, `filterLog`,
  `prettyMessage`, `pushHistory`, `messageProblem`), so the tested code is the code the page runs.
- Its variables are scoped like the HTTP panel's (`ws::<project>::<component>`); its log colors JSON with the
  theme's JSON colors.
- The state goes to the host's `memory` like the HTTP panel's; `ComponentPanel.openKeys`/`restore` cover the
  `ws::` panels too, which come back with their sockets closed.

## In the workspace

The tool `http-connections` of the strip (`Ctrl+Alt+H`). Its pane is the environment bar and the tree; the ⇄ API action of a
backend project jumps to its routes ([the workspace](../../../../vscode/docs/02-architecture/workspace.md)).

Verbs and sections use theme colors the extension contributes (`colors` in `package.json`:
`nuclearHttpConnections.get/post/put/patch/delete/platform/project/component`, with dark and light defaults; a theme may
override them; in CSS `var(--vscode-nuclearHttpConnections-get)`), and for the pages' code
`nuclearHttpConnections.jsonKey/jsonString/jsonNumber/jsonBoolean/jsonNull/jsonPunctuation/markupTag/markupAttribute`
(the page falls back to `--vscode-debugTokenExpression-*` and `--vscode-symbolIcon-*`). The Chernobyl themes set them from the palette
([the theme](../../../../vscode/docs/02-architecture/theme.md)).

## The JetBrains tool window (`HttpConnections.java`)

The VS Code view in Swing, on the left, `Alt+Shift+H` (`keyboard-shortcut` in `plugin.xml`).

- `findProjects` walks the IDE's project folder for `.nuclear/project.json` + `contract.json`; `endpointsOf` gives a
  backend's `controllers` as routes and a mobile or web app's `repositories` as calls; `declaredContracts` from
  `config.nuc`; environments in `<project>/.nuclear/http.json`; OpenAPI documents (`loadOpenApi`).
- `Panel` = the tree (`ColoredTreeCellRenderer`, the Chernobyl colors per verb, platform, project and component; a
  `WS` mark on what is served over WebSockets; events; the environment's *WebSockets*) + a `CardLayout` of the request
  panel (`java.net.http`, pretty JSON with Gson, copy as curl; *Open over WebSocket* when the route is also served
  there) and `SocketPanel` (`java.net.http.WebSocket`: one socket at a time, the same url, headers, draft, history and
  filtered log as VS Code's, closed when the tool window's content is disposed).
- The contract's WebSocket fields are read as in VS Code (`transportsOf`, `eventsOf`, `socketPathOf`,
  `guardHeadersOf`); an event proposes `subscribe` only.
- Title actions: select the environment, add an OpenAPI document, add a WebSocket url, update the contracts
  (`~/.local/bin/nuclear contracts update`, with a notification), refresh.

## Settings and languages

- The settings of HTTP Connections are its own section of the editor's settings, read only through `src/settings.ts`: `nuclear.http.timeoutSeconds`, how long a request waits for its answer (30 s)
  (spec 011, settings by component).
- Its texts are in English and Spanish in `src/l10n.ts` (dictionaries of `extensions/vscode/src/i18n.ts`): `HTTP` for
  the request page (`panel.ts`; the host sends it keys, never English sentences), `WS` for the WebSocket page (`socketPanel.ts`); HTTP words (Headers, Body, Path,
  Query) stay as they are. The host's texts (the tree, the log's connection lines) are `l10n.t` of `i18n.ts`, in
  `extensions/vscode/l10n/bundle.l10n.es.json`. The JetBrains window is in English only, like the rest of it.
  The host sends the page the texts of the chosen language (`nuclear.language`); English is the fallback. Both pages
  have the globe in their bar; a change re-renders them and gives them back their tabs and environment (`localize`).
