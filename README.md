# NuclearLang

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) [![platform-mobile](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml) [![platform-backend](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-backend.yml) [![platform-web](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-web.yml) [![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml) [![extension-zed](https://github.com/nuclearlang/lang/actions/workflows/extension-zed.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-zed.yml) [![website](https://github.com/nuclearlang/lang/actions/workflows/website.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/website.yml) · [Website](https://nuclearlang.github.io)

A minimal base language for AI agents and the people who work with them. A Rust transpiler turns `.nuc` into
TypeScript, Dart or Python through declarative dialects, and its framework, Synapsis, gives three platforms
(`web`, `mobile`, `backend`) written once in Nuclear.

## Why

- Agents spend most of their tokens on code that is always the same; in Nuclear only the business logic is written.
- One way to write each thing, errors that come with their fix, type definitions so nobody invents an API.
- One way only (`.nuc` → target); it never replaces the target's own tools. [Vision](docs/00-context/vision.md).

## How we made it

- One golden rule: performance, speed and readability of the syntax ([ADRs of the language](nuclearlang/docs/03-adr/README.md)).
- The parser never changes per dialect; a dialect is TOML and templates, not compiler code.
- English everywhere ([ADR-platform-0001](docs/03-adr/0001-english-everywhere.md)).
- One repository, a project per folder ([ADR-platform-0002](docs/03-adr/0002-one-repository-a-project-per-folder.md)); the AI loop ([ADR-platform-0003](docs/03-adr/0003-the-ai-loop.md)).
- A product is made with the tools ([ADR-platform-0004](docs/03-adr/0004-products-are-made-with-the-tools.md)).

## Try it

```sh
curl -fsSL https://nuclearlang.github.io/install.sh | sh   # Windows: irm https://nuclearlang.github.io/install.ps1 | iex
nuclear new todos_api -p backend && cd todos_api           # a project: only .nuc files
nuclear gen resource todos Todo --fields "id:int title:string completed:boolean"
nuclear build && nuclear install && nuclear test           # FastAPI by default; dialect = "nestjs" for NestJS
```

## The tree

| Folder | What it is |
|---|---|
| [nuclearlang/](nuclearlang/README.md) | the language: compiler, language server, dialects |
| [nuclear-synapsis-framework/](nuclear-synapsis-framework/README.md) | the framework and its three platforms |
| [tools/](tools/README.md) | the `nuclear` command, the code generator, the MCP server |
| [extensions/](extensions/README.md) | the editors (VS Code, Cursor, Android Studio, IntelliJ, Zed) and their tools |
| [device-emulators/](device-emulators/README.md) | the devices the tools and editors start |
| [nuclear-graph-storage/](nuclear-graph-storage/README.md) · [nuclear-agents/](nuclear-agents/README.md) | the private knowledge base and the local agents |
| [installer/](installer/README.md) · [website/](website/README.md) | the installers and the documentation site |

## Read next

- [The tutorial](nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch.
- [The language guide](nuclearlang/docs/08-guides/README.md) and [the dialects](nuclearlang/dialects/README.md).
- [The platforms](nuclear-synapsis-framework/platforms/README.md).
- [AGENTS.md](AGENTS.md) and [docs/README.md](docs/README.md): the map and the rules for contributors.

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md). License: [Apache-2.0](LICENSE).
