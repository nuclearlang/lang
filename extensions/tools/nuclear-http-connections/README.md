# HTTP Connections

[![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml) · [Website](https://nuclearlang.github.io/tools/http-connections)

An HTTP client like Postman or Bruno, inside the editor, that already knows every endpoint of your projects. In VS
Code (`Ctrl+Alt+H`) and JetBrains (`Alt+Shift+H`).

## Why

- No retyping paths, parameters and bodies: the compiler already wrote them to `.nuclear/contract.json`.
- One tree by platform, project and component: the routes a backend exposes and the calls an app makes.
- Environments, app contracts and OpenAPI (JSON) documents of APIs that are not Nuclear.
- Left out on purpose: it never reads your code; today only HTTP REST.

## How we made it

- The endpoints come from the contract, never the code ([ADR-synapsis-0006](../../../nuclear-synapsis-framework/docs/03-adr/0006-shared-contracts.md); format in [projects §1.2](../../../nuclearlang/docs/07-reference/projects.md)).
- A tool of the Nuclear workspace: one tab per component, endpoints inside it ([ADR-extensions-0002](../../docs/03-adr/0002-the-nuclear-workspace.md)).
- The extension host sends the request and resolves `{{var}}`, not the page.
- TypeScript for VS Code, Java for JetBrains. Never yet run in a live editor ([roadmap](docs/01-product/roadmap.md)).

## Try it

Install the [VS Code extension](../../vscode/README.md), open a built Nuclear project and press `Ctrl+Alt+H`. Click
an endpoint, then **Send**.

## Read next

- [The guide](docs/08-guides/README.md): the tree, requests, environments, OpenAPI
- [Architecture](docs/02-architecture/overview.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
