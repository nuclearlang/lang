# The tools of NuclearLang

What a person, an AI agent or an editor runs to work with NuclearLang: the `nuclear` command, the code generator
behind `nuclear new`, `make` and `gen`, and the MCP server an AI client talks to. Three projects, each with its own
README and documents.

| Project | What it is | Read |
|---|---|---|
| [`cli/`](cli/) | `nuclear`, the one command: the compiler (`build`, `check`, `fix`, `fmt`, `spec`, `defs`) and the framework, Synapsis (`new`, `gen`, `make`, `run`, `test`, `add`, the devices) | [README](cli/README.md) |
| [`code_generator/`](code_generator/) | `nuclear-codegen`: the finished code `new`, `gen` and `make` write, from each platform's templates | [README](code_generator/README.md) |
| [`mcp/`](mcp/) | `nuclear-mcp`: the tools an AI client (Claude Code, Codex, Cursor, OpenCode) calls, written in Nuclear | [README](mcp/README.md) |

## Why they exist

An agent that writes an application spends most of its tokens on code that is always the same, and invents APIs
that do not exist ([the vision](../docs/00-context/vision.md)). These tools take that work away: the generators
write the standard code, the compiler says exactly what is wrong and how to fix it, and the MCP server hands both
to any AI client with the same instructions. A product of the platform is made with them, never by writing or
porting target code by hand ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## How they lean on each other

```
 MCP server ──runs──► nuclear ──calls──► nuclear-codegen ──reads──► code_generator/platforms/<platform>/generators.toml
                         │
                         └──uses──► the language crates and the dialects' data; nuclear-devices (device-emulators/)
```

- **One entry point.** Everything goes through `nuclear`: a person, an agent, the editor and the MCP server run the
  same binary, so what works in one works in all of them
  ([ADR-cli-0003](cli/docs/03-adr/0003-one-command-nuclear.md)).
- **The MCP server adds no logic of its own to the generators**: a generator tool is a `nuclear gen` command.
- **The CLI and the code generator are Rust**; the MCP server is a Nuclear project built with the `python` dialect.

## Try it

```sh
nuclear help                  # every command, of the compiler and of the framework
nuclear-mcp tools             # the MCP server's instructions and its tools, as JSON
```

## Where to read next

- Each project's README (the table above), then its `AGENTS.md` to change it. The folder's map:
  [AGENTS.md](AGENTS.md).
- The devices `nuclear device` and `nuclear terminal-device` run: [device-emulators](../device-emulators/README.md).
- How the tools get onto a machine: [the installer](../installer/README.md).
