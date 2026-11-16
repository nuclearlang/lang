# nuclear-connector

The tool like Postman or Bruno inside the editor. The code calls it **Nuclear HTTP** today: every endpoint of every
project as a tree by platform, project and component, read from the contract the compiler writes; the contracts an
app declares; OpenAPI documents of APIs that are not Nuclear; environments; and a request panel. It is a tool of the
Nuclear workspace in VS Code (`Ctrl+Alt+H`) and a tool window in Android Studio / IntelliJ (`Alt+Shift+H`).

Today it speaks only HTTP (REST). The user's plan is more protocols: http, sockets, grpc, udp
([roadmap](docs/01-product/roadmap.md)).

## Where the code is today
It moves into this folder in [spec 008, T4.4](../../../docs/04-specs/008-restructure/tasks.md).

| File | What it is |
|---|---|
| `extensions/vscode/src/http.ts` | `HttpModel`: the projects, the tree, the environments, the commands |
| `extensions/vscode/src/httpPanel.ts` | `ComponentPanel`: one editor tab per component, one inner tab per endpoint |
| `extensions/jetbrains/src/dev/nuclearlang/editor/NuclearHttp.java` | the *Nuclear HTTP* tool window, in Swing |

`extensions/vscode/src/connections.ts` is assigned to this folder by spec 008, but it is not part of Nuclear HTTP:
it checks the connections of the AI services (the Developer, the graph, Ollama, the integrations), and is
documented with [the settings page](../../vscode/docs/02-architecture/ai-services.md).
`TODO(human): does connections.ts move here with the tool, or stay with the settings page?`

## Stack
- TypeScript; the request is sent by the extension host with `fetch`; the panel is plain HTML and script
- Java with `java.net.http` and Gson for the JetBrains tool window

## Commands
Run in `extensions/vscode/`: `npm run compile`. In `extensions/jetbrains/`:
`IDE_HOME=/opt/android-studio ./build.sh`. The tool has no test of its own.

## Rules
- The endpoints come from `.nuclear/contract.json`, never from reading the project's code.
- The tree in VS Code is drawn by the workspace's webview, with the `nuclearHttp.*` colors of the theme.
- A component is an editor tab and each endpoint a tab inside it: the tab bar never fills with requests.
- A request is sent by the extension host, not by the webview; `{{var}}` is resolved there.
- The decisions: ADR-extensions-0002 (the workspace), ADR-synapsis-0006 (the contract).

## Documents (read by task)
| You need… | Read |
|---|---|
| The model, the tree, the environments, the panel, the JetBrains window | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| The pending work: the protocols, what was never tried | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The colors of the tree | [the theme](../../vscode/docs/02-architecture/theme.md) |
| How the tree is drawn in the workspace's pane | [the workspace](../../vscode/docs/02-architecture/workspace.md) |
| The contract's format | [projects §1.2](../../../nuclearlang/docs/07-reference/projects.md) |
