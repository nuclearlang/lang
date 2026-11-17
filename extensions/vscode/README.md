# NuclearLang for VS Code

[![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml) · [Website](https://nuclearlang.github.io/tools/vscode)

**NuclearLang** (`.nuc`) is a minimal language made to be written by AI agents and read by people; a Rust
transpiler turns it into expert Dart/Flutter, TypeScript or Python. This extension brings the language server, the
dialects, the **Nuclear workspace** and the **Chernobyl** themes.

## Why

- Less to write, one way to write it: Nuclear drops the target's imports and boilerplate and keeps the logic.
- Writing, running, debugging, calling the API and the local agents, in one window.

## What it brings

- **The language server**: live diagnostics with quick fixes, completion, hover, go to definition, rename, semantic colors.
- **Show Generated Code** beside the `.nuc`, and **code metrics** above each function.
- **The Nuclear workspace** (`Ctrl+Alt+N`): projects and tools as tabs, each action with a key.
- **Run, debug and reload on save**, with breakpoints in the `.nuc`.
- **The devices** (`Ctrl+Alt+V`): a mobile or web app inside the editor.
- **HTTP Connections** (`Ctrl+Alt+H`): an HTTP client that knows every endpoint of your projects.
- **Nuclear Builder** (`Ctrl+Alt+P`): a spec taken through plan, tests, code, verification and deploy.
- **Nuclear Atlas** (`Ctrl+Alt+A`): a local chat answered from the Nuclear Smart Graph.
- **Settings and integrations** (`Ctrl+Alt+S`) and the AI services set-up.
- **The Chernobyl and Chernobyl Soft themes**, with file icons.

## How we made it

- **One language server, one base extension per editor**; a dialect is only data
  ([ADR-extensions-0001](../docs/03-adr/0001-one-base-extension-per-editor.md)).
- **The Nuclear workspace**: one thing on screen at a time, keyboard first
  ([ADR-extensions-0002](../docs/03-adr/0002-the-nuclear-workspace.md)).
- **The tools come first**: *New with Synapsis* runs `nuclear make` and `nuclear gen`
  ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- **Written in TypeScript**, bundled with esbuild; panels in plain HTML.

## Try it

```sh
code --install-extension nuclearlang-<version>.vsix
```

Open a `.nuc` file: diagnostics appear while you type. `Ctrl+Alt+N` opens the workspace.

## Read next

- [The guide](docs/08-guides/README.md): every command, key and setting
- [The workspace](docs/08-guides/workspace.md), [run and debug](docs/08-guides/run-and-debug.md)
- [What changed](CHANGELOG.md)
- To change it: [AGENTS.md](AGENTS.md)
