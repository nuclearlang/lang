# NuclearLang in the editors

[![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml) [![extension-zed](https://github.com/nuclearlang/lang/actions/workflows/extension-zed.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-zed.yml) · [Website](https://nuclearlang.github.io/tools/extensions)

Extensions for VS Code, Android Studio / IntelliJ and Zed. Each starts the same language server, and brings the
platform's tools (Nuclear Builder, HTTP Connections, Nuclear Atlas, the devices) where the code is.

## Why

- Write, run, debug, call the API and hand work to agents in one place, not a terminal per task.
- The same diagnostics, completion and colors in every editor.
- No language or dialect logic in an extension: that is `nuclear-lsp` and the dialects' data.

## How we made it

- **One language server, one base extension per editor** ([ADR-extensions-0001](docs/03-adr/0001-one-base-extension-per-editor.md)).
- **The Nuclear workspace**: one container, every project and tool a tab ([ADR-extensions-0002](docs/03-adr/0002-the-nuclear-workspace.md)).
- **One source for what they share**: themes, icons and grammar generated from `vscode/`.
- **The tools make the product** ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md));
  each tool is a project in [`tools/`](tools/).
- Written in TypeScript, Java and Rust to wasm: an editor runs only its own language.

## Try it

```sh
installer/install.sh                                     # installs the VS Code and Zed extensions it can
(cd extensions/vscode && npm install && npm run package) # → nuclearlang-<version>.vsix
```

Open a `.nuc` file: diagnostics appear while you type. In VS Code, `Ctrl+Alt+N` opens the workspace.

## Read next

- [Which editor has what](docs/08-guides/README.md)
- [VS Code](vscode/README.md), [Android Studio / IntelliJ](jetbrains/README.md), [Zed](zed/README.md)
- [The decisions](docs/03-adr/README.md), [the roadmap](docs/01-product/roadmap.md)
- To change it: [AGENTS.md](AGENTS.md)
