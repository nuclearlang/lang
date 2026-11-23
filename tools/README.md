# The tools of NuclearLang

[![ci](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/tools)

What a person, an AI agent or an editor runs to work with NuclearLang: the `nuclear` command, the code generator
behind `new`, `make` and `gen`, and the MCP server an AI client talks to.

| Project | What it is |
|---|---|
| [`cli/`](cli/README.md) | `nuclear`, the one command: the compiler and the framework, Synapsis |
| [`code_generator/`](code_generator/README.md) | `nuclear-codegen`: the finished code `new`, `gen` and `make` write |
| [`mcp/`](mcp/README.md) | `nuclear-mcp`: the tools an AI client calls, written in Nuclear |

## Why

- An agent spends most of its tokens on code that is always the same, and invents APIs that do not exist
  ([the vision](../docs/00-context/vision.md)).
- The generators write the standard code; the compiler says what is wrong and how to fix it.
- The MCP server hands both to any AI client, with the same instructions.

## How we made it

- **One entry point**: a person, an agent, the editor and the MCP server run the same `nuclear`
  ([ADR-cli-0003](cli/docs/03-adr/0003-one-command-nuclear.md)).
- **Products are made with the tools**, never by writing target code by hand
  ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- **No logic twice**: an MCP generator tool is a `nuclear gen` command.
- The CLI and the code generator are Rust; the MCP server is Nuclear, built with the `python` dialect.

## Try it

```sh
nuclear help                  # every command, of the compiler and of the framework
nuclear-mcp tools             # the MCP server's instructions and its tools, as JSON
```

## Read next

- [The devices](../device-emulators/README.md) that `nuclear device` runs
- [The installer](../installer/README.md): how the tools get onto a machine
- To change them: [AGENTS.md](AGENTS.md)
