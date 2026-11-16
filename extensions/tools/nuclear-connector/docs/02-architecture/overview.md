---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../01-product/roadmap.md, ../../../../docs/03-adr/0002-the-nuclear-workspace.md, ../../../../vscode/docs/02-architecture/workspace.md]
---
# Architecture of Nuclear Connector

A basic Bruno / Postman inside the editor (ADR-extensions-0002) over the contract the compiler writes
(ADR-synapsis-0006). Not run in a VS Code window nor in a running IDE yet ([roadmap](../01-product/roadmap.md)).

## Where the endpoints come from

`.nuclear/contract.json` is written next to the project card `.nuclear/project.json` (by `project::write_metadata`,
so the language server's `Project::build` produces it): the app, its version, platform and dialect, its `models`,
its `controllers` (what a backend exposes) and its `repositories` (what a mobile or web app calls), each a
component with its routes (verb, path, params in path / query / body, what it returns)
([projects §1.2](../../../../../nuclearlang/docs/07-reference/projects.md)).

## The model (`connector.ts`)

`activateConnector(context)` returns the `HttpModel`.

- `findProjects` walks the workspace folders (depth 4, skipping `build`, `node_modules`…) for
  `.nuclear/project.json` and reads the `contract.json` next to it. The model watches `**/.nuclear/*.json`.
- `tree()` gives the `TreeNode`s the workspace's webview draws: platform → project → *Contracts* (with ↓ update
  buttons) / component → endpoint; and *OpenAPI documents* (with +) from the active environment's `openapi` list,
  grouped by tag.
- `declaredContracts(root)`: the contracts an app declares in its `config.nuc`.
- `sampleOf`: a sample body from the contract's model.
- **Environments**: `<first workspace folder>/.nuclear/http.json`, else `globalStorageUri/http.json`. Its shape:
  `active`, and `environments.<name>.{vars, headers, baseUrls, openapi}`. `{{var}}` is resolved by the extension
  host.

Commands: `nuclear.connector.{refresh,selectEnvironment,editEnvironments,addOpenApi,open}` and
`nuclear.contracts.update (root?, name?)`, which runs `~/.local/bin/nuclear contracts update` in the project (the
output channel *Nuclear Connector*).

## A component's panel (`panel.ts`)

`ComponentPanel`: one webview panel per `componentKey(endpoint)`, like a Bruno folder, with an inner tab per
endpoint opened from the tree. Each inner tab keeps its request and its last response:

- the method, the url with its path and query parameters, the headers, the body (with the sample);
- send: by the extension host with `fetch`, a 30 s timeout, the active environment's variables and headers;
- the response pretty-printed; *copy as curl*.

The webview posts its whole state (`tabs`, `active`) on every change and the model keeps it in `memory` by key, so
`restore(keys)` rebuilds the panels when the Connector workspace is entered again (`model.reopen` = the keys open when
it was left). The memory lives in the window, not on disk.

## In the workspace

The tool `connector` of the strip (`Ctrl+Alt+H`). Its pane is the environment bar and the tree; the ⇄ API action of a
backend project jumps to its routes ([the workspace](../../../../vscode/docs/02-architecture/workspace.md)).

Verbs and sections use theme colors the extension contributes (`colors` in `package.json`:
`nuclearConnector.get/post/put/patch/delete/platform/project/component`, with dark and light defaults; a theme may
override them; in CSS `var(--vscode-nuclearConnector-get)`). The Chernobyl themes set them from the palette
([the theme](../../../../vscode/docs/02-architecture/theme.md)).

## The JetBrains tool window (`NuclearConnector.java`)

The VS Code view in Swing, on the left, `Alt+Shift+H` (`keyboard-shortcut` in `plugin.xml`).

- `findProjects` walks the IDE's project folder for `.nuclear/project.json` + `contract.json`; `endpointsOf` gives a
  backend's `controllers` as routes and a mobile or web app's `repositories` as calls; `declaredContracts` from
  `config.nuc`; environments in `<project>/.nuclear/http.json`; OpenAPI documents (`loadOpenApi`).
- `Panel` = the tree (`ColoredTreeCellRenderer`, the Chernobyl colors per verb, platform, project and component) +
  the request panel (`java.net.http`, pretty JSON with Gson, copy as curl).
- Title actions: select the environment, add an OpenAPI document, update the contracts
  (`~/.local/bin/nuclear contracts update`, with a notification), refresh.
