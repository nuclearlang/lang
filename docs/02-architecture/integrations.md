---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Integrations and contracts between projects

| Interface | Provider | Consumers | Where it is described |
|---|---|---|---|
| The Rust API of the compiler (`transpile`, `check`, `project::build`, `Loader`) | `nuclearlang/crates/` | the language server, the command line tool | `nuclearlang/docs/02-architecture/` |
| The dialect format (TOML, templates) and its contract | `nuclearlang/` | every dialect, kind packages | `nuclearlang/docs/07-reference/dialects.md` |
| A platform's contract (`platform.toml`) | each platform | its framework dialects, the loader | `nuclear-synapsis-framework/platforms/docs/` |
| The LSP protocol and the `nuclear/*` requests | the language server | the three extensions | `nuclearlang/docs/02-architecture/` |
| The commands of `nuclear` and their JSON output | `tools/cli/` | the extensions, the agents, the MCP server | `tools/cli/docs/` |
| What `new`, `make` and `gen` write (`Wrote::Created` / `Kept`, `generators.toml`) | `tools/code_generator/` | `tools/cli/` | `tools/code_generator/docs/` |
| The devices (`nuclear device`, `nuclear terminal-device`) | `device-emulators/` | `tools/cli/` | `device-emulators/docs/` |
| MCP tools (stdio, `nuclear-mcp`) | `tools/mcp/` | Claude Code, Codex, Cursor, OpenCode | `tools/mcp/docs/` |
| The graph's HTTP API (127.0.0.1:7878, a token per client) | `nuclear-graph-storage/` | the Developer, the MCP server, the editors | `nuclear-graph-storage/docs/` |
| The Developer's HTTP API (127.0.0.1:7879) | `nuclear-agents/nuclear_developer/` | the pipeline tool, Nuclear Atlas, the MCP server | `nuclear-agents/nuclear_developer/docs/` |
| A backend's published contract (OpenAPI, `/.nuclear/contract.json`) | a backend project | mobile and web projects (`contracts(...)`) | `nuclear-synapsis-framework/docs/` |
| The published pages (`docs/07-reference/`, `docs/08-guides/` of each project; route = the path in the tree) | every project | `website/` | `website/docs/02-architecture/content.md` |
| The layout of an installation | `installer/release/stage.sh` | the binaries (`nuclear_dialect::Home::install`), the extensions' bundles | `installer/docs/` |
