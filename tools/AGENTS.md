# Tools

The three projects under `tools/`: what a person, an AI agent or an editor runs to work with NuclearLang. Each
documents itself; open the `AGENTS.md` of the one the task touches.

| Project | Folder | What it is | Start here |
|---|---|---|---|
| The command line tools | `tools/cli/` | The `nuclear` binary (build, check, fix, fmt, help, spec, defs, contracts, dialect, agent) and, until it is merged in, the `dragonfly` binary (projects, build, run, test, packages, migrations, devices) | [cli/AGENTS.md](cli/AGENTS.md) |
| The code generator | `tools/code_generator/` | What `dragonfly gen` and `dragonfly make` write: finished code from a resource's data, and one skeleton per kind | [code_generator/AGENTS.md](code_generator/AGENTS.md) |
| The MCP server | `tools/mcp/` | The tools an AI client (Claude Code, Codex, Cursor, OpenCode) calls: the generators, the compiler, the command line, the Smart Graph, the local developer, the internet | [mcp/AGENTS.md](mcp/AGENTS.md) |

## How they lean on each other

```
 MCP server ──runs──► nuclear, dragonfly ──calls──► code generator
     │                      │                            │
     │ HTTP                 │ Rust API                   │ data
     ▼                      ▼                            ▼
 Smart Graph,        nuclearlang/crates          platform.toml of each platform
 Nuclear Developer   + the dialects' data        ([layout], [skeletons], [[generators.*]])
```

- **The CLI** uses the language crates as a library (`nuclearlang/crates/`: `nuclear-diag`, `nuclear-syntax`,
  `nuclear-dialect`, `nuclear-transpile`) and takes everything about a target from data: a dialect's `[toolchain]`
  and `[project.manifest]`, a platform's `platform.toml`. `gen` and `make` are the code generator.
- **The code generator** reads the fields of a resource, fills the templates of the project's platform and writes
  each file at the platform's `[layout]` place. The templates are the platform's, never code of the generator.
- **The MCP server** runs the two commands (so every generator is also a tool), and reaches the Smart Graph
  (`nuclear-graph-storage/`) and the Nuclear Developer (`nuclear-agents/nuclear_developer/`) over HTTP.

## Where the code is today

Two of the three projects are still inside another one (spec 008, phase 4:
[tasks](../docs/04-specs/008-restructure/tasks.md)):

| Project | Its code today | Moves here in |
|---|---|---|
| `tools/cli/` | `tools/cli/src/` (`nuclear`) and `nuclear-synapsis-framework/cli/src/` (`dragonfly`) | T2.2 |
| `tools/code_generator/` | `nuclear-synapsis-framework/cli/src/generate.rs`, `scaffold.rs`; the data in each `nuclear-synapsis-framework/platforms/<platform>/platform.toml` | T4.2 |
| `tools/mcp/` | `nuclear-graph-storage/mcp_server.nuc` (started with `nuclear-graph mcp`) | T4.3 |

The other folders that used to be under `tools/` are the language's: `nuclearlang/tools/` (`defs`, `spec-check`,
`stdlib-check.sh`, `node`, `python`).
