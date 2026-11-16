# `nuclear-mcp`, the MCP server

The program an AI client (Claude Code, Codex, Cursor, OpenCode) starts to work with NuclearLang. It speaks the
Model Context Protocol over stdio and offers four things as tools: the **generators** that write the standard code,
the **local developer** that writes what is left, the **Smart Graph** to look things up instead of guessing, and the
**compiler** to check everything; plus the command line and the internet.

## Why it exists

Every client should work the same way on a Nuclear project, whatever model is behind it. The server's instructions
tell each one how: call `graph_strategy` first, inspect the project, generate before writing, give the local
developer only what the generators leave, then validate and correct. A frontier model leads; the standard code
costs it no tokens, and it never has to guess an API.

What it leaves out on purpose:

- **No generator code of its own.** A generator tool is a `nuclear gen` command; its options and refusals are
  [the code generator's](../code_generator/README.md).
- **`nuclear_project` runs only the commands of its list**, and the graph is reached with the token of the client
  `mcp`: the user decides whether MCP clients may read it.
- **A machine set up for remote agents only** gets no `graph_*` and no `developer_*` tools, and other instructions.
- **What comes from the internet is untrusted text**: no code blocks, and never a page of this machine or the local
  network.

## How we made it

- **It is a product of the platform, written in Nuclear.** The source is five `.nuc` files (`server.nuc`,
  `cli.nuc`, `__init__.nuc` and two of tests); `nuclear build .` turns them into the Python package
  `build/nuclear_mcp` with the `python` dialect, and `pyproject.toml` packages it. Nobody edits `build/`
  ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- **A tool is a method with a comment**: the comment is the description the client reads.
- **The Smart Graph through its type definitions.** The server imports the graph's Python package `nuclear-graph`;
  its API comes from generated type definitions in `defs/python/nuclear_graph/0.2.0/`, so the Nuclear code is
  checked against the real package.
- **A project of its own.** It was a module of the graph's package (`nuclear-graph mcp`); it moved into `tools/mcp`
  so its code, tests and dependencies live together and the graph's package is lighter. It depends on the graph,
  never the other way: the graph's knowledge base reads the tools by running `nuclear-mcp tools`, and
  `nuclear-graph mcp` still runs `nuclear-mcp` ([ADR-mcp-0001](docs/03-adr/0001-the-mcp-server-is-a-project-of-its-own.md)).
- The decisions that created it are kept elsewhere: the AI loop
  ([ADR-platform-0003](../../docs/03-adr/0003-the-ai-loop.md)) and the generator tools
  ([ADR-codegen-0001](../code_generator/docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md)).

## Try it

The server comes with the AI services ([their set-up](../../installer/docs/08-guides/ai-setup.md)). Once
`nuclear-mcp` is on the PATH:

```sh
nuclear-mcp tools                          # {"instructions": ..., "tools": [...]}: 27 tools with the local agents
                                           # (graph_*, nuclear_*, project_inspect, generate_*, api_inspect, web_*, developer_*)
claude mcp add --scope user nuclear -- nuclear-mcp   # Claude Code; Codex: codex mcp add nuclear -- nuclear-mcp
```

From the source, in `tools/mcp`:

```sh
nuclear check .                            # .: 5 files, no errors
nuclear build .                            # nuclear_mcp: 5 files → build
```

## Where to read next

- [The guide](docs/08-guides/mcp.md): the set-up of each client, how a model works with the server, every tool and
  its parameters, what to do when a tool fails.
- [How it is built](docs/02-architecture/overview.md), [the decisions](docs/03-adr/README.md),
  [the roadmap](docs/01-product/roadmap.md).
- What it reaches: [the Smart Graph](../../nuclear-graph-storage/README.md) and
  [the local developer](../../nuclear-agents/AGENTS.md).
- To change it: [AGENTS.md](AGENTS.md).
