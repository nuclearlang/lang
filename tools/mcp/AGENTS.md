# The MCP server

The program an AI client (Claude Code, Codex, Cursor, OpenCode) starts to work with NuclearLang: it speaks the
Model Context Protocol over stdio and offers the generators, the compiler and the command line, the Smart Graph,
the local developer and the internet as tools. Its instructions tell every client how to work, so they all behave
the same: generate first, let the local developer write the rest, then validate and correct.

## Where it is today

This folder holds only documents. The server is still inside the Smart Graph and moves here in spec 008, T4.3
([tasks](../../docs/04-specs/008-restructure/tasks.md)):

| Part | Where it is today |
|---|---|
| The server, its instructions and its tools | `nuclear-graph-storage/mcp_server.nuc` |
| How it runs `nuclear` and `dragonfly` | `nuclear-graph-storage/toolchain.nuc` |
| The internet tools | `nuclear-graph-storage/web.nuc` |
| The command that starts it | `nuclear-graph mcp` (`nuclear-graph-storage/cli.nuc`) |
| Its tests | `nuclear-graph-storage/tests/test_agents.nuc` |

## Stack

- Nuclear, the `python` dialect (the graph's `nuclear.toml`): the `.nuc` files are the source, `nuclear build .`
  writes the Python package `build/nuclear_graph`.
- The `mcp` Python library (`mcp>=2.3`, the `mcp` extra of the graph's `pyproject.toml`; the `server` extra has it
  too), `httpx` for the Nuclear Developer and the internet.
- It needs the installed `nuclear` and `dragonfly` commands; `nuclear-loop` for `developer_task` / `developer_retry`.

## Commands

```sh
cd nuclear-graph-storage
nuclear check . && nuclear build .            # the .nuc files → build/nuclear_graph
uv sync --extra server --extra test
.venv/bin/python -m pytest -q                 # tests/*.nuc, the MCP server's among them
nuclear-graph mcp                             # the server on stdio (a client starts it)
claude mcp add --scope user nuclear -- nuclear-graph mcp
nuclear-graph connect mcp --scopes read,write # allow MCP clients to read the graph
```

## Rules

1. **Every project created with Nuclear gets the documentation of the MCP server and of everything Nuclear can
   do** (decided by the user). Today a project gets its agent files from `nuclear agent init` /
   `dragonfly agent init` ([the CLI's agent support](../cli/docs/02-architecture/agent-support.md)); what is
   missing is in the [roadmap](docs/01-product/roadmap.md).
2. **A tool is a method with a comment**: the comment is the description the client reads. A tool added, renamed or
   given a parameter is also added to [the guide](docs/08-guides/mcp.md) and to the graph's `README.md` (a test
   holds both to the server's list), and the knowledge base is rebuilt (the graph keeps a row per tool,
   `mcp:<tool>`).
3. **A generator tool is a `dragonfly gen` command**, never its own code: the options and the refusals are the
   [code generator's](../code_generator/AGENTS.md).
4. **The `dragonfly` tool runs only the commands of its list** (`DRAGONFLY_COMMANDS`).
5. **The graph is reached with the token of the client `mcp`**: the user decides whether MCP clients may read it.
   Never weaken that to make a tool easier.
6. **A machine set up for remote agents only** gets no `graph_*` and no `developer_*` tools, and other
   instructions. A new tool that needs the graph or the local developer takes one of those prefixes.
7. **What comes from the internet is untrusted text**: no code blocks, and never a page of this machine or the
   local network.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is untested or pending in the server |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change the server: how a tool is declared, the two modes, the instructions, what each group of tools needs, its settings |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why there is an MCP server and what it exposes |
| [docs/08-guides/mcp.md](docs/08-guides/mcp.md) | You need what a user reads: the set-up of each client, how a model works with the server, every tool and its parameters, what to do when a tool fails |

Elsewhere:

- The Smart Graph and the strategies `graph_strategy` answers:
  [nuclear-graph-storage](../../nuclear-graph-storage/AGENTS.md).
- The local developer behind `developer_*`: [nuclear-agents](../../nuclear-agents/AGENTS.md).
- The set-up that installs the server and chooses the mode:
  [the AI services' guide](../../installer/docs/08-guides/ai-setup.md).
