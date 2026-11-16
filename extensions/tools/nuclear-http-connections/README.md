# HTTP Connections

An HTTP client like Postman or Bruno, inside the editor, that already knows every endpoint of your projects. It is
a tool of the Nuclear workspace in VS Code (`Ctrl+Alt+H`) and a tool window in Android Studio / IntelliJ
(`Alt+Shift+H`).

## Why it exists

Calling the API of a backend you are writing means typing every path, parameter and body into another program, and
typing them again when they change. The compiler already knows them: it writes each project's endpoints to
`.nuclear/contract.json`. The HTTP Connections tool reads that file and shows a tree by platform, project and component, with
the routes a backend exposes and the calls an app makes. It also lists the contracts an app declares (with
*↓ Update*), OpenAPI documents of APIs that are not Nuclear, and environments (`.nuclear/http.json`: variables,
headers, base urls).

What it leaves out: it never reads your code to find an endpoint, and today it speaks only HTTP (REST: GET, POST,
PUT, PATCH, DELETE). More protocols (sockets, gRPC, UDP) are the user's plan ([roadmap](docs/01-product/roadmap.md)).
An OpenAPI document must be JSON.

## How we made it

- **The endpoints come from the contract**, never from the code
  ([ADR-synapsis-0006](../../../nuclear-synapsis-framework/docs/03-adr/0006-shared-contracts.md); its format:
  [projects §1.2](../../../nuclearlang/docs/07-reference/projects.md)). Build the project, or open one of its
  `.nuc` files, and the tree follows.
- **A tool of the Nuclear workspace** ([ADR-extensions-0002](../../docs/03-adr/0002-the-nuclear-workspace.md)): a
  component is one editor tab and each endpoint a tab inside it, so the tab bar never fills with requests.
- **The request is sent by the extension host**, not by the page, and `{{var}}` is resolved there.
- **Written in TypeScript** for VS Code (bundled by the extension, sent with `fetch`) and Java for the JetBrains
  tool window (`java.net.http`, Gson). It has no test of its own.

**State:** never run in a VS Code window nor in a running IDE; the JetBrains window is only compiled
([roadmap](docs/01-product/roadmap.md)).

## Try it

Install the [VS Code extension](../../vscode/README.md), open a folder with a built Nuclear project (one that has
`.nuclear/project.json`) and press `Ctrl+Alt+H`. Click an endpoint: its tab has the path and query parameters,
the headers, a sample body from the model, **Send**, the pretty-printed response and *copy as curl*. A backend
project's ⇄ action (*Routes in HTTP Connections*) opens the same tree.

To build it from the tree: `cd extensions/vscode && npm run compile`; the JetBrains window:
`cd extensions/jetbrains && IDE_HOME=/opt/android-studio ./build.sh`.

## Where to read next

| | |
|---|---|
| The tree, sending a request, the environments, OpenAPI | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The model, the tree, the panel, the JetBrains window | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |
