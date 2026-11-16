---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, dependencies.md, language-server.md, projects.md]
---
# Integrations and contracts

What other projects use of this one. A change here is a change for them.

## The Rust API

| Crate | What its users call |
|---|---|
| `nuclear_syntax` | `parse`, `lex`, `parse_type`, `ast`, `token`, `DocComment`, `fmt::format`, `habits` |
| `nuclear_dialect` | `Loader`, `Dialect`, `Report`, `Home`, `homes`, `install_dir`, `defs_cache_dir`, `base_doc`, `defs` (`TypeDefs`, `Decl`, `Member`, `Constructor`, `Param`, `render*`), `library` (`MEMBERS`, `BASES`, `OBJECTS`, `WRONG`) |
| `nuclear_transpile` | `transpile`, `check`, `Output`, `project` (`Manifest`, `build`, `output_dir`, `with_project_defs`, `metadata`, `write_metadata`, `line_map`), `contract` (`contract`, `openapi`, `write`, `sync`), `map` (`map`, `inventory`, `shape`) |
| `nuclear_diag` | `Diagnostic`, `SourceFile`, the codes |

The language server walks the AST itself, and so do the two command line tools: a changed variant of `ast.rs` or
a changed signature above is caught by the workspace build (`cargo build` from the root of the tree).

## The language server

| Interface | Detail |
|---|---|
| Transport | JSON-RPC over stdin/stdout (`Content-Length`); the server exits on stdin EOF |
| Standard requests | hover, completion, signature help, definition, references, document highlight, rename, document symbols, folding, code actions, on-type formatting, code lens, semantic tokens, `workspace/executeCommand` |
| `nuclear/transpile` | the generated code of a document (its project output when the file equals disk) |
| `nuclear/codeMetrics` | the code metrics of a document |
| Commands | `nuclear.toggleCodeMetricsDisplayed`, `nuclear.toggleCodeMetricsForArrowFunctions`, `nuclear.codeMetrics`, `nuclear.showCodeMetricsCodeLensInfo` |
| `nuclear-lsp --version` | the version |
| `nuclear-lsp --codemetrics-defaults` | every code metrics setting with its default, as JSON: the editors generate their settings pages from it |
| `nuclear-lsp --check-bundle` | loads every dialect next to the binary; exit code 1 on any diagnostic: the last step of an editor package |

The extensions talk to the server only through LSP and these requests.

## Files a build writes for other tools

| File | Written by | Read by |
|---|---|---|
| `.nuclear/project.json` (the project card) | `project::write_metadata` (`METADATA_FILE`) | the editors (the VS Code status bar) |
| `.nuclear/map.md` (the project map) | `map::write`, with the card | an agent before it writes |
| `.nuclear/contract.json` | `contract::write` (`CONTRACT_FILE`), under the project and its output folder | a client project that declares it in `contracts(...)`; the Nuclear Connector of the editors |
| `.nuclear/openapi.json` | `contract::write`, only for a `backend` project | any OpenAPI tool |
| `contracts/<name>/` | `contract::sync`, at the start of `project::build` | the client project's own build |
| `<output>/.nuclear/lines.json` (the line map) | the command line tools, from `project::line_map` (`LINE_MAP_FILE`) | the editors' debuggers |

The formats are normative: `docs/07-reference/projects.md` §1.1 (the card and the map) and §1.2 (the contract).
The commands that write them (`nuclear build`, `nuclear contracts list|update`) are documented in `../tools/cli/`.
A mobile build writes its line map to `build/app/.dart_tool/nuclear_lines.json` (the `nuclear` command).

## What it reads

| Data | Where |
|---|---|
| Dialects | the `dialects/` of each home (`nuclear_dialect::homes`: the install, then the source tree), plus the paths its caller gives |
| Platform contracts | `platforms/<platform>/platform.toml` next to each `dialects/` (in the tree: `../nuclear-synapsis-framework/platforms/`) |
| The platforms' generators | `generators/<platform>/generators.toml` next to each `dialects/` (in the tree: `../tools/code_generator/platforms/`; `Loader::generators_file`) |
| Kind packages | `<project>/kinds`, `<install>/kinds` (`Loader.packages`) |
| Type definitions | `<language>/defs/` of each dialects folder, the `defs/` next to it, extra roots, the cache → [type-definitions.md](type-definitions.md) |
| Environment | `NUCLEAR_HOME` (the install), `NUCLEAR_DIALECT_PATH` (extra dialect folders, `:`-separated), `XDG_CACHE_HOME` (the definitions cache) |

## Boundaries

- Only the base registers the language, the grammar and the server in an editor; a framework's editor features
  activate on their dialect's `[project] marker`.
- The `nuclear` command uses the crates as a library; what it needs from a platform comes from the dialect
  (`[toolchain]`); its mobile path still calls Flutter from its own code.
- The same data files feed the command line tool, the language server and the MCP server.
