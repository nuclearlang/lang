# NuclearLang in the editors

The extensions that bring NuclearLang (`.nuc`) to three editors: VS Code, Android Studio / IntelliJ and Zed. Each
one starts the same language server, so a `.nuc` file gets the same diagnostics, completion and colors everywhere,
and puts the platform's tools (Nuclear Builder, HTTP Connections, Nuclear Atlas, the devices) where the code is.

## Why it exists

A `.nuc` file is written in an editor, and so is everything a developer does around it: run the app, debug it, call
its API, hand work to the agents. Without the extensions that means a terminal per task and several windows for a
backend and its apps. The extensions put every Nuclear feature in one place.

What they leave out on purpose:

- **The language itself.** Completion, hover, diagnostics and the project rules are the language server,
  `nuclear-lsp`, in [the language project](../nuclearlang/AGENTS.md). An extension only talks to it.
- **Any dialect.** The kinds, the documentation of each word and where a project's output goes are data of the
  dialect and of the project card the server writes; no extension hard-codes a path, a port or a command.
- **Nuclear Builder in Zed**, decided by the user. Zed also lets an extension add no panels, views or keybindings,
  so the workspace, the devices and `.nuc` debugging cannot be built there.

## How we made it

- **One language server, one base extension per editor**
  ([ADR-extensions-0001](docs/03-adr/0001-one-base-extension-per-editor.md)). Only the base extension registers the
  language, the grammar and the server; what a framework adds (run, debug, devices) is meant to go in an extension
  of that framework. Until those exist, the VS Code and JetBrains extensions carry the Synapsis parts
  ([roadmap](docs/01-product/roadmap.md)).
- **The Nuclear workspace** ([ADR-extensions-0002](docs/03-adr/0002-the-nuclear-workspace.md)): in VS Code, one
  container where every project and every tool is a tab, one thing on screen at a time, keyboard first. The other
  editors follow as far as their platform allows.
- **One source for what the three share.** The Chernobyl themes and icons of all three are generated from
  `vscode/theme/`; the TextMate grammar of VS Code is also packed by the JetBrains plugin; the code metrics settings
  are generated from the server's defaults. Nothing generated is edited by hand.
- **A tool is a project of its own** in [`tools/`](tools/), with its code and documents; an extension only wires
  it in.
- **Written in the editors' languages**: TypeScript for VS Code, Java for JetBrains (compiled with `javac`, no
  Gradle), Rust to wasm for Zed. An editor runs only its own language, so this is where Nuclear cannot be the source
  yet (root [`AGENTS.md`](../AGENTS.md), rule 9).
- **The tools make the product** ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)):
  the extensions are where a developer runs `nuclear`, the generators and Nuclear Builder, not a place to write
  target code.
- One version for the three extensions.

What was never tried in a running editor is listed in each roadmap: the JetBrains plugin is only compiled, and many
VS Code panels were checked only headless.

## Try it

The installer installs what it can, with `nuclear` and `nuclear-lsp`. From the tree:

```sh
installer/install.sh                            # the newest vscode/nuclearlang-*.vsix when `code` is on the PATH;
                                                # builds and installs the Zed extension when Zed is installed
(cd extensions/vscode && npm install && npm run package)            # → nuclearlang-<version>.vsix
(cd extensions/jetbrains && IDE_HOME=/opt/android-studio ./build.sh) # → build/nuclearlang-<version>.zip
(cd extensions/zed && ./build.sh)                                    # builds and installs into Zed
```

Open a `.nuc` file: diagnostics appear while you type. In VS Code, `Ctrl+Alt+N` opens the Nuclear workspace.

## Where to read next

| | |
|---|---|
| Which editor has what, how to install each | [docs/08-guides/README.md](docs/08-guides/README.md) |
| VS Code | [vscode/README.md](vscode/README.md) |
| Android Studio / IntelliJ | [jetbrains/README.md](jetbrains/README.md) |
| Zed | [zed/README.md](zed/README.md) |
| The tools | [Nuclear Builder](tools/nuclear-builder/README.md), [HTTP Connections](tools/nuclear-http-connections/README.md), [Nuclear Atlas](tools/nuclear-atlas/README.md), [the devices](tools/nuclear-device-manager/README.md) |
| How the parts fit | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| Why it is this way | [docs/03-adr/README.md](docs/03-adr/README.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it, or to release | [AGENTS.md](AGENTS.md), [docs/06-runbooks/release.md](docs/06-runbooks/release.md) |
