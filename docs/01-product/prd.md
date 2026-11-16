---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Product requirements: the NuclearLang platform

What the platform must do as a whole. Each project's own requirements and their state are in that project's
`docs/01-product/`.

## Functional requirements

| ID | Requirement | Project |
|---|---|---|
| FR-01 | A base language: header and block, 2-space indentation, values everywhere, modules, inheritance, generics, `Result<E, T>` with automatic propagation, aliases, destructuring, generators, cascades | `nuclearlang/` |
| FR-02 | A file or a project of several files is transpiled to TypeScript, Dart and Python | `nuclearlang/` |
| FR-03 | Dialects are data: inheritance, templates, kinds, decorators, options, keywords, a contract | `nuclearlang/`, each dialect |
| FR-04 | Type definitions per package and version: auto-imports, inherited members, the API for the language server and the agents | each dialect |
| FR-05 | Diagnostics with codes, positions and fixes, as text and as JSON | `nuclearlang/` |
| FR-06 | A language server: diagnostics, completion, hover, signature help, rename, metrics, documentation | `nuclearlang/` |
| FR-07 | Extensions for VS Code, JetBrains and Zed | `extensions/` |
| FR-08 | A framework with three platforms (web, mobile, backend), each written once and built by its dialects | `nuclear-synapsis-framework/` |
| FR-09 | One command line tool: new, make, gen, build, run, test, devices, packages | `tools/cli/` |
| FR-10 | `.nuc` is debugged through the target's debugger | `nuclearlang/`, `extensions/` |
| FR-11 | Agents are supported: a brief, a skill, files for a project, an evaluation | `tools/cli/` |
| FR-12 | A private knowledge base, an MCP server, local agents and a pipeline tool | `nuclear-graph-storage/`, `tools/mcp/`, `nuclear-agents/`, `extensions/tools/` |
| FR-13 | One installer per system, with the AI services | `installer/` |

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Generated code passes the target's analyzer without warnings (`flutter analyze`, `tsc --strict`, `pyright --strict`) |
| NFR-02 | A build with no change takes about 40 ms; a project build about 20 ms in release |
| NFR-03 | The parser never changes per dialect; Rust decides what is emitted, the dialect how |
| NFR-04 | Everything in English (`ADR-platform-0001`) |
| NFR-05 | Every diagnostic code is documented; every dialect word is documented for the editor |
| NFR-06 | Errors over magic: no inferred parameters, no hoisting; explicit beats implicit when in doubt |
| NFR-07 | A local model has at most 3B parameters (`ADR-platform-0003`) |

## Open questions
- TODO(human): which metrics say the platform reached its goals (tokens saved, tasks an agent completes)?
