# NuclearLang

A minimal base language, made so agents (Claude, Codex, OpenCode...) and people write it fast, that
transpiles to other technologies through **dialects**.

# Vision

NuclearLang avoids writing unnecessary code or text, to spend as few tokens as possible, and it tries to be
extremely easy to use, write and read. NuclearLang avoids at all costs the text that has nothing to do with the
program's logic: it exists to write the program's logic in the easiest way and with the least text possible, and
everything else, which from the point of view of a program's logic is unnecessary, is left to the transpilers.
This helps agents not having to think about unnecessary context: only what matters, the logic of a product.

```
             ┌──────────── typescript dialect ──► .ts
 file.nuc ───┤──────────── nestjs dialect ──────► .ts (modules, controllers...)
  (base)     ├──────────── react dialect ───────► .ts (React)
             ├──────────── fastapi dialect ─────► .py (FastAPI)
             └──────────── flutter dialect ─────► .dart
```

As in an ORM (Sequelize with MySQL, Postgres or SQLite): the user writes one single form and each **adapter**
(dialect) knows how to translate it to its technology.

## Installation

One command, no Rust needed (the release of your system from GitHub, checked by SHA-256, into your user folders):

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh        # Linux and macOS (--version <v>, --uninstall)
irm https://nuclearlang.github.io/install.ps1 | iex             # Windows (PowerShell)
```

From the source tree (it needs Rust; for Flutter apps, Flutter: `FLUTTER` or `FLUTTER_ROOT` if it is not on the PATH):

```sh
installer/install.sh                 # builds and installs nuclear, dragonfly and nuclear-lsp in ~/.local/bin + the VS Code and Zed extensions
installer/install.sh --no-vscode     # without the VS Code extension (--no-zed: without the Zed one)
installer/install.sh --uninstall     # uninstalls
PREFIX=/usr/local installer/install.sh
```

The files go to `~/.local/share/nuclearlang` (`NUCLEAR_HOME` chooses another folder). How the installers and the
release are made: [installer/](installer/AGENTS.md).

## The tree

One repository. Each folder is a project with its own `AGENTS.md` and `docs/`:

| Folder | What it is |
|---|---|
| [nuclearlang/](nuclearlang/AGENTS.md) | the language: the compiler, the language server, the base words, the examples |
| [nuclearlang/dialects/](nuclearlang/dialects/README.md) | the dialects: `python` (with `fastapi`), `typescript` (with `nestjs`, `react`), `dart` (with `flutter`), `nodejs` |
| [nuclear-synapsis-framework/](nuclear-synapsis-framework/AGENTS.md) | the framework and its three platforms: `mobile`, `backend`, `web` |
| [tools/](tools/AGENTS.md) | the command line tools, the code generator, the MCP server |
| [extensions/](extensions/AGENTS.md) | the VS Code, JetBrains and Zed extensions and their tools |
| [device-emulators/](device-emulators/AGENTS.md) | the devices the tools and the editors start |
| [nuclear-graph-storage/](nuclear-graph-storage/AGENTS.md) | the Smart Graph: the local, private knowledge base every agent reads |
| [nuclear-agents/](nuclear-agents/AGENTS.md) | the local agents |
| [installer/](installer/AGENTS.md) | the installers and the release |
| [docs/](docs/README.md) | what is about the whole platform: vision, architecture, decisions, standards |

The documentation site is a repository of its own, `website`, written in Nuclear: it reads the `.md` files of this
tree at build time.

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md). License: [Apache-2.0](LICENSE).

## Try it

```sh
cargo test                                                                                  # every crate
cargo run -q -p nuclear-cli -- build nuclearlang/examples/examples-nodejs/chat.nuc --dialect nodejs    # transpile
cargo run -q -p nuclear-cli -- check nuclearlang/examples/examples-nodejs/chat.nuc --dialect nodejs --json   # errors for agents
cargo run -q -p nuclear-cli -- dialect list                                                 # available dialects
cargo run -q -p nuclear-cli -- spec --dialect flutter                                       # everything an agent needs: base + dart + flutter
```

With the `flutter` dialect every widget and class of Flutter and of the Dart libraries can be used, besides
`bloc`/`flutter_bloc`, `dio`, `get_it` and `json_annotation`: the imports are added automatically. Everything comes
from the **type definitions** (like TypeScript's `.d.ts`). `nuclear defs show Scaffold --dialect flutter` shows
the API of any class in Nuclear notation.

## Where to read

| Document | What it contains |
|---|---|
| [The tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md) | **Start here:** an app from scratch, step by step (`nuclear help tutorial`) |
| [The language guide](nuclearlang/docs/08-guides/README.md) | The language by chapters, with the real outputs (`nuclear help guide`) |
| [The language on one page](nuclearlang/docs/08-guides/reference.md) | The whole base in tables (`nuclear help reference`) |
| [The rules of the base language](nuclearlang/docs/07-reference/nuclear-base.md) | What every dialect inherits; with the [grammar](nuclearlang/docs/07-reference/grammar.ebnf), the [error codes](nuclearlang/docs/07-reference/diagnostics.md), the [standard library](nuclearlang/docs/07-reference/library.md) and the [reserved words](nuclearlang/docs/07-reference/reserved-words.md) |
| [The dialect format](nuclearlang/docs/07-reference/dialects.md) | Templates, shortcuts, kinds, validation, how to create a dialect with an agent |
| [Each dialect](nuclearlang/dialects/README.md) | What it adds to the base, how it translates it, the equivalences of the examples |
| [Projects of several files](nuclearlang/docs/07-reference/projects.md) | `nuclear.toml`, imports between files, architecture rules |
| [Type definitions](nuclearlang/docs/07-reference/definitions.md) | The format, the import priority, `nuclear defs` |
| [How the transpiler works](nuclearlang/docs/08-guides/architecture.md) | Its stages and the rules of its design |
| [The platforms](nuclear-synapsis-framework/platforms/AGENTS.md) | What a mobile, a backend and a web project write |
| [AGENTS.md](AGENTS.md) | The rules and the map for agents and contributors |
