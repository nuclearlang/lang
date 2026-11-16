---
status: in-progress
owner: Julian Molina
updated: 2026-11-16
---
# Spec 008: restructure the tree — Design

## Target tree

```
AGENTS.md  CLAUDE.md  README.md  Cargo.toml     the map, the hard rules, one Cargo workspace
docs/                                           the whole platform only
nuclearlang/                                    the language
  crates/        nuclear-diag, -syntax, -dialect, -transpile, -lsp
  base/          the base language's words and their docs (was languages/)
  dialects/<language>/                          python, typescript, dart, nodejs: one project each
    dialect.toml keywords.toml library.toml docs.toml templates/
    frameworks/<framework>/                     fastapi, nestjs, react, flutter: a platform written in this language
    defs/<package>/<version>/                   type definitions
    docs/
  examples/  tools/  docs/
extensions/
  vscode/  jetbrains/  zed/
  tools/<tool>/                                 nuclear-builder, nuclear-connector, nuclear-ai-chat,
                                                nuclear-device-manager; not built: nuclear-documentor,
                                                nuclear-ui-designer, nuclear-backend-designer,
                                                nuclear-storage-connector
device-emulators/                               the devices the CLI and the editors start
nuclear-agents/nuclear_developer/               the local agents
nuclear-synapsis-framework/                     the framework (was Dragonfly)
  platforms/<platform>/                         web, mobile, backend
    platform.toml  packages/  examples/  checks/  docs/
tools/
  cli/                                          the `nuclear` command
  code_generator/platforms/<platform>/          what `nuclear gen` and `nuclear make` write
  mcp/                                          the MCP server
installer/                                      the installers and the release
nuclear-graph-storage/                          the Smart Graph (the RAG) and its knowledge base (`data/`)
```

## Where each old folder goes

| Old | New |
|---|---|
| `crates/nuclear-{diag,syntax,dialect,transpile,lsp}` | `nuclearlang/crates/` |
| `crates/nuclear-cli`, `agents/` | `tools/cli/`, `tools/cli/agent-files/` |
| `languages/` | `nuclearlang/base/` |
| `dialects/<language>/` | `nuclearlang/dialects/<language>/` |
| `defs/<language>/`, `dragonfly-*/defs/<language>/` | `nuclearlang/dialects/<language>/defs/` |
| `dragonfly-*/dialects/<platform>/<dialect>/` | `nuclearlang/dialects/<language>/frameworks/<dialect>/` |
| `dragonfly-*/dialects/<platform>/platform.toml` | `nuclear-synapsis-framework/platforms/<platform>/platform.toml` |
| `dragonfly-*/{packages,examples}` | `nuclear-synapsis-framework/platforms/<platform>/{packages,examples}` |
| `dragonfly-*/tools/` | `nuclear-synapsis-framework/platforms/<platform>/checks/` |
| `spec/` (base), `docs/language/` | `nuclearlang/docs/07-reference/`, `nuclearlang/docs/08-guides/` |
| `spec/<language>.md`, `dragonfly-*/spec/<dialect>.md`, their briefs | `nuclearlang/dialects/<language>/docs/07-reference/` |
| `dragonfly-*/spec/<platform>.md`, its brief, `dragonfly-*/docs/dragonfly/` | `…/platforms/<platform>/docs/07-reference/`, `08-guides/` |
| `specs/` | `docs/04-specs/`, then each plan to its project |
| `examples/` | `nuclearlang/examples/` |
| `tools/{defs,spec-check,stdlib-check.sh,node,python}` | `nuclearlang/tools/` |
| `tools/{agent-eval,thesis}` | `nuclear-synapsis-framework/eval/` |
| `tools/context/` | `.claude/hooks/` |
| `tools/release/`, `install.sh`, `dist/` | `installer/` |
| `dragonfly/` (docs, the CLI crate) | `nuclear-synapsis-framework/`; the crate merges into `tools/cli/` (phase 2) |
| `nuclear-vscode/`, `nuclear-jetbrains/`, `nuclear-zed/` | `extensions/{vscode,jetbrains,zed}/` |
| `nuclear-developer/` | `nuclear-agents/nuclear_developer/` |
| `nuclear-graph/`, `nuclear-developer/data/` | `nuclear-graph-storage/`, `nuclear-graph-storage/data/` |
| `docs/context/`, `docs/adr/`, `docs/ai/`, `STATUS.md` | each project's `docs/` (phase 3) |

`github-profile/` stays a repository of its own: GitHub reads an organization's profile only from its `.github`
repository.

## How the loader finds things

- A dialect is `dialects/<language>/` or `dialects/<language>/frameworks/<name>/`; its name is the folder's.
- A framework dialect names its platform (`platform = "backend"` in `dialect.toml`); the contract is
  `platforms/<platform>/platform.toml`, found in the loader's platform folders.
- Type definitions are `dialects/<language>/defs/<package>/<version>/`. A project's own `defs/` and the cache keep
  `<language>/<package>/<version>/`.
- An install has the same two folders: `$NUCLEAR_HOME/dialects` and `$NUCLEAR_HOME/platforms`.

## Docs layout of a project

`AGENTS.md` (an index, under 150 lines) and `docs/` with the layers of `agent-context-docs-implementation.md`
(`00-context` … `06-runbooks`) plus `07-reference` (the normative text: a language's rules, a dialect's
equivalences, a platform's kinds) and `08-guides` (what a user reads). A layer with nothing to say has no file.
Pending work is `docs/01-product/roadmap.md` of the project it belongs to.

## Risks

| Risk | Mitigation |
|---|---|
| A move loses uncommitted work of the 11 repositories | A copy of the whole tree before the first move: `~/Documents/projects/nuclearlang-backup-2026-11-16-pre-restructure.tar.gz` |
| A path in code, a script or CI still names an old folder | After each phase: `cargo test`, clippy, and a search of the tree for the old names |
| The installed commands and services stop | They run from `~/.local/share/nuclearlang`, not from the tree; reinstalled once at the end |
| The knowledge base describes the old tree | Rebuilt and ingested once, when the docs are in place (phase 3) |
