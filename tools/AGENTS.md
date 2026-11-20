# Tools

The three projects under `tools/`: what a person, an AI agent or an editor runs to work with NuclearLang. Each
documents itself; open the `AGENTS.md` of the one the task touches.

| Project | Folder | What it is | Start here |
|---|---|---|---|
| The command line tool | `tools/cli/` | The `nuclear` command: the compiler's commands (build, check, fix, fmt, help, spec, defs, contracts, dialect, agent) and the framework's (new, make, gen, run, test, install, migrate, add, devices...) | [cli/AGENTS.md](cli/AGENTS.md) |
| The code generator | `tools/code_generator/` | The crate `nuclear-codegen`: what `nuclear new`, `make` and `gen` write, from each platform's `generators.toml` | [code_generator/AGENTS.md](code_generator/AGENTS.md) |
| The MCP server | `tools/mcp/` | `nuclear-mcp`, a Nuclear project of its own: the tools an AI client (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI) calls: the generators, the compiler, the command line, the Smart Graph, the local developer, the internet | [mcp/AGENTS.md](mcp/AGENTS.md) |

## How they lean on each other

```
 MCP server ──runs──► nuclear ──calls──► nuclear-codegen ──reads──► code_generator/platforms/<platform>/generators.toml
     │                   │                                          ([gen], [skeletons], [[generators.*]])
     │ the graph's       │ Rust API
     │ package, HTTP     ▼
     ▼               nuclearlang/crates + the dialects' data; nuclear-devices (device-emulators/)
 Smart Graph,
 Nuclear Developer
```

- **The CLI** uses the language crates as a library (`nuclearlang/crates/`: `nuclear-diag`, `nuclear-syntax`,
  `nuclear-dialect`, `nuclear-transpile`) and takes everything about a target from data: a dialect's `[toolchain]`
  and `[project.manifest]`, a platform's `platform.toml` (`[layout]`). `new`, `make` and `gen` call the code
  generator; `device` and `terminal-device` call [the devices](../device-emulators/AGENTS.md).
- **The code generator** reads the fields of a resource, fills the templates of the project's platform and writes
  each file at the platform's `[layout]` place. The templates are data (`generators.toml`), never code of the
  generator.
- **The MCP server** runs `nuclear` (so every generator is also a tool), and reaches the Smart Graph
  (`nuclear-graph-storage/`, through its Python package) and the Nuclear Developer
  (`nuclear-agents/nuclear_developer/`) over HTTP.

The other folders that used to be under `tools/` are the language's: `nuclearlang/tools/` (`defs`, `spec-check`,
`stdlib-check.sh`, `node`, `python`).
