# Nuclear Connector (`nuclear-connector`)

The tool like Postman or Bruno inside the editor, **Nuclear Connector**: every endpoint of every
project as a tree by platform, project and component, read from the contract the compiler writes; the contracts an
app declares; OpenAPI documents of APIs that are not Nuclear; environments; and a request panel. It is a tool of the
Nuclear workspace in VS Code (`Ctrl+Alt+H`) and a tool window in Android Studio / IntelliJ (`Alt+Shift+H`).

Today it speaks only HTTP (REST). The user's plan is more protocols: http, sockets, grpc, udp
([roadmap](docs/01-product/roadmap.md)).

## Where the code is
All of it is in this folder. The VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`);
the JetBrains `build.sh` compiles `jetbrains/src/` with the plugin.

| File | What it is |
|---|---|
| `src/connector.ts` | `HttpModel`: the projects, the tree, the environments, the commands |
| `src/panel.ts` | `ComponentPanel`: one editor tab per component, one inner tab per endpoint |
| `jetbrains/src/dev/nuclearlang/editor/NuclearConnector.java` | the *Nuclear Connector* tool window, in Swing |

`extensions/vscode/src/connections.ts` is not part of this tool: it checks the connections of the AI services and
stays with [the settings page](../../vscode/docs/02-architecture/ai-services.md).

## Stack
- TypeScript; the request is sent by the extension host with `fetch`; the panel is plain HTML and script
- Java with `java.net.http` and Gson for the JetBrains tool window

## Commands
Run in `extensions/vscode/`: `npm run compile`. In `extensions/jetbrains/`:
`IDE_HOME=/opt/android-studio ./build.sh`. The tool has no test of its own.

## Rules
- The endpoints come from `.nuclear/contract.json`, never from reading the project's code.
- The tree in VS Code is drawn by the workspace's webview, with the `nuclearConnector.*` colors of the theme.
- A component is an editor tab and each endpoint a tab inside it: the tab bar never fills with requests.
- A request is sent by the extension host, not by the webview; `{{var}}` is resolved there.
- The decisions: ADR-extensions-0002 (the workspace), ADR-synapsis-0006 (the contract).

## Documents (read by task)
| You need… | Read |
|---|---|
| The model, the tree, the environments, the panel, the JetBrains window | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What a user reads: the tree, sending a request, the environments | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work: the protocols, what was never tried | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The colors of the tree | [the theme](../../vscode/docs/02-architecture/theme.md) |
| How the tree is drawn in the workspace's pane | [the workspace](../../vscode/docs/02-architecture/workspace.md) |
| The contract's format | [projects §1.2](../../../nuclearlang/docs/07-reference/projects.md) |
