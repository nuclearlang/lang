# `nuclear-mcp`, the MCP server

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/tools/mcp)

The program an AI client (Claude Code, Codex, Cursor, OpenCode) starts to work with NuclearLang, over stdio. Its tools:
the **generators**, the **local developer**, the **Smart Graph** and the **compiler**.

## Why

- Every client works the same way on a Nuclear project, whatever model is behind it.
- Standard code costs the model no tokens, and it never has to guess an API.
- Safe by default: `nuclear_project` runs only its listed commands; internet text is untrusted.

## How we made it

- **Written in Nuclear**, five `.nuc` files built into a Python package
  ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- **A project of its own**, depending on the graph, never the other way
  ([ADR-mcp-0001](docs/03-adr/0001-the-mcp-server-is-a-project-of-its-own.md)).
- **Part of the AI loop** ([ADR-platform-0003](../../docs/03-adr/0003-the-ai-loop.md)); a generator tool is a
  `nuclear gen` command ([ADR-codegen-0001](../code_generator/docs/03-adr/0001-the-generators-write-finished-code-the-agent-only-what-is-not-standard.md)).
- **A tool is a method with a comment**: the comment is what the client reads.

## Try it

```sh
nuclear-mcp tools                                    # {"instructions": ..., "tools": [...]}
claude mcp add --scope user nuclear -- nuclear-mcp   # Claude Code; Codex: codex mcp add nuclear -- nuclear-mcp
```

## Read next

- [The guide](docs/08-guides/mcp.md): each client's set-up, every tool
- [Set up the AI services](../../installer/docs/08-guides/ai-setup.md)
- [How it is built](docs/02-architecture/overview.md), [the decisions](docs/03-adr/README.md)
- [The Smart Graph](../../nuclear-graph-storage/README.md)
- To change it: [AGENTS.md](AGENTS.md)
