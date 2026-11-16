---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Dependencies

## Between projects

| Project | Depends on | How |
|---|---|---|
| `nuclearlang/crates/nuclear-lsp` | the compiler crates | Rust library |
| `tools/cli/` | the compiler crates, the dialects, the platforms' contracts | Rust library, data |
| `nuclearlang/dialects/<language>/frameworks/<dialect>/` | its language dialect, its platform's contract | `extends`, `platform` in `dialect.toml` |
| `nuclear-synapsis-framework/platforms/<platform>/` | the dialects that implement it | data; its checks build its examples with each |
| `extensions/*` | the language server, the command line tool | the LSP protocol, processes |
| `extensions/tools/*` | the command line tool, the Developer, the graph | processes, HTTP |
| `nuclear-agents/nuclear_developer/` | the graph, the compiler | the graph's client, HTTP |
| `nuclear-graph-storage/` | the whole tree (its documents and data are what it stores), the compiler (it is written in Nuclear) | `knowledge build`, `nuclear build` |
| `tools/mcp/` | the graph, the compiler, the command line tool, the Developer | library, processes, HTTP |
| `installer/` | every project | the layout of an installation (`installer/release/stage.sh`) |

## External

| Dependency | Use | Risk if it changes |
|---|---|---|
| Rust (stable, edition 2024) | the compiler, the language server, the command line tools | low |
| Flutter and Dart | the mobile platform's target; the Dart type definitions generator | a new stable deprecates what the runtime uses (see `nuclearlang/dialects/dart/`) |
| Python 3.12+ | the backend platform's `fastapi` target; the graph; the Developer | the generated code targets 3.12; only 3.14 is installed here |
| Node.js | the backend `nestjs` and the web `react` targets; the VS Code extension; the pipeline tool's command | low |
| Ollama | the local models and the embeddings | the services stop when it does |
| Chroma | the graph's store | low |

The versions each project pins are in its `docs/02-architecture/dependencies.md` or its manifest.
