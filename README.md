# NuclearLang

A minimal base language for AI agents and the people who work with them. A transpiler written in Rust turns `.nuc`
into TypeScript, Dart or Python through **declarative dialects**, and the language comes with its framework,
Synapsis: three platforms (`web`, `mobile`, `backend`) written once in Nuclear.

```
             ┌── typescript ──► .ts            ┌── react ────► .ts  (web)
 file.nuc ───┼── python ──────► .py            ├── fastapi ──► .py  (backend)
  (base)     └── dart ────────► .dart          ├── nestjs ───► .ts  (backend)
                                               └── flutter ──► .dart (mobile)
```

## Why it exists

An AI agent that writes an application spends most of its tokens on code that is always the same: the wiring of a
framework, imports, serialization, state, tests. It also invents APIs that do not exist, and people read and review
all of it. In Nuclear only the business logic is written: one way to write each thing, the fewest tokens, errors
that come with their fix, type definitions so nobody invents an API. The framework brings the architecture and the
transpiler writes the rest.

What it leaves out on purpose: it never reads or converts target code into Nuclear (one way only, `.nuc` → target);
it does not replace the target's own tools (Flutter's command still builds and runs, `nuclear` drives it); it has
no package manager of its own. The whole vision: [docs/00-context/vision.md](docs/00-context/vision.md).

## How we made it

- **One golden rule judges every proposal**: performance, speed and readability of the syntax. Generated code as
  fast as an expert's, instant transpilation, minimal readable Nuclear. A rule, kind or shortcut that breaks one of
  the three is rejected (ADR-lang-0001, [nuclearlang/docs/03-adr/](nuclearlang/docs/03-adr/README.md)).
- **The parser never changes per dialect.** Rust decides *what* is emitted; a dialect, TOML and templates loaded at
  run time, decides *how*. A new target or framework is data, not a change to the compiler.
- **A platform is the same for every dialect of it.** The Nuclear of a project does not change when its dialect
  changes; the standard library is Nuclear's own.
- **Everything in English**, code and documents alike
  ([ADR-platform-0001](docs/03-adr/0001-english-everywhere.md)).
- **One repository, a project per folder**, each with its own `AGENTS.md` and `docs/`, so a task reads the root map
  and one project's documents ([ADR-platform-0002](docs/03-adr/0002-one-repository-a-project-per-folder.md)).
- **The AI loop**: a private knowledge base, local agents of at most 3B parameters, one MCP server and a pipeline
  tool in the editor ([ADR-platform-0003](docs/03-adr/0003-the-ai-loop.md)).
- **A product is made with the tools**: its code is Nuclear, its target code comes from the transpiler, its
  standard parts from `nuclear new`/`gen`/`make`, its libraries from `nuclear add`
  ([ADR-platform-0004](docs/03-adr/0004-products-are-made-with-the-tools.md)). The website is one of them.

The compiler, the language server, the `nuclear` command, the code generator and the devices are Rust; the MCP
server, the local agents and the website are written in Nuclear. How the projects fit together:
[docs/02-architecture/overview.md](docs/02-architecture/overview.md).

## Installation

One command, no Rust needed (the release of your system from GitHub, checked by SHA-256, into your user folders):

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh        # Linux and macOS (--version <v>, --uninstall)
irm https://nuclearlang.github.io/install.ps1 | iex             # Windows (PowerShell)
```

From the source tree (it needs Rust; for Flutter apps, Flutter: `FLUTTER` or `FLUTTER_ROOT` if it is not on the PATH):

```sh
installer/install.sh                 # builds and installs nuclear and nuclear-lsp in ~/.local/bin (and nuclear-builder) + the VS Code and Zed extensions
installer/install.sh --no-vscode     # without the VS Code extension (--no-zed: without the Zed one)
installer/install.sh --uninstall     # uninstalls
PREFIX=/usr/local installer/install.sh
```

The files go to `~/.local/share/nuclearlang` (`NUCLEAR_HOME` chooses another folder). How the installers and the
release are made: [installer/](installer/AGENTS.md).

## Try it

Save this as `hello.nuc`:

```
greet(name: string) string
  "Hello, ${name}"
```

```sh
nuclear build hello.nuc --dialect python        # def greet(name: str) -> str:  (then) return f"Hello, {name}"
nuclear build hello.nuc --dialect typescript    # export function greet(name: string): string { ... }
nuclear build hello.nuc --dialect dart          # String greet(String name) { return 'Hello, $name'; }
nuclear check hello.nuc --dialect python --json # the errors for agents: code, position, the exact fix
nuclear dialect list                            # every dialect found, with what it extends
nuclear spec --brief --dialect flutter          # the short sheet an agent reads before writing
nuclear help tutorial                           # a Flutter app from scratch with Synapsis
```

From the source tree, `cargo run -q -p nuclear-cli -- <command>` runs the same commands, and `cargo test` checks
every crate against every dialect and platform example.

## The tree

One repository. Each folder is a project with its own `AGENTS.md` and `docs/`:

| Folder | What it is |
|---|---|
| [nuclearlang/](nuclearlang/README.md) | the language: the compiler, the language server, the base words, the examples |
| [nuclearlang/dialects/](nuclearlang/dialects/README.md) | the dialects: `python` (with `fastapi`), `typescript` (with `nestjs`, `react`), `dart` (with `flutter`), `nodejs` |
| [nuclear-synapsis-framework/](nuclear-synapsis-framework/AGENTS.md) | the framework and its three platforms: `mobile`, `backend`, `web` |
| [tools/](tools/AGENTS.md) | the `nuclear` command, the code generator, the MCP server |
| [extensions/](extensions/AGENTS.md) | the VS Code, JetBrains and Zed extensions and their tools |
| [device-emulators/](device-emulators/AGENTS.md) | the devices the tools and the editors start |
| [nuclear-graph-storage/](nuclear-graph-storage/AGENTS.md) | the Smart Graph: the local, private knowledge base every agent reads |
| [nuclear-agents/](nuclear-agents/AGENTS.md) | the local agents |
| [installer/](installer/AGENTS.md) | the installers and the release |
| [website/](website/README.md) | the documentation site, written in Nuclear: it reads the `.md` files of this tree at build time |
| [docs/](docs/README.md) | what is about the whole platform: vision, architecture, decisions, standards |

## Where to read next

- [The tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch (`nuclear help tutorial`).
- [The language guide](nuclearlang/docs/08-guides/README.md) (`nuclear help guide`) and
  [the language on one page](nuclearlang/docs/08-guides/reference.md) (`nuclear help reference`).
- [The rules of the base language](nuclearlang/docs/07-reference/nuclear-base.md) and
  [each dialect's equivalences](nuclearlang/dialects/README.md).
- [The platforms](nuclear-synapsis-framework/platforms/AGENTS.md): what a mobile, a backend and a web project write.
- [AGENTS.md](AGENTS.md): the rules and the map for agents and contributors;
  [docs/README.md](docs/README.md): how every project documents itself.

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md). License: [Apache-2.0](LICENSE).
