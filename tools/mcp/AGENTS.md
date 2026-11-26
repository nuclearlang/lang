# The MCP server

`nuclear-mcp`: the program an AI client (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI) starts to work with NuclearLang. It
speaks the Model Context Protocol over stdio and offers the generators, the compiler and the command line, the Smart
Graph and the internet as tools, and the tools that organize the user's work (spec 022): workspaces and their apps,
the specs Nuclear Builder reads, the teams; every change among them is asked to the user first. Its instructions tell every client how to work, so they all behave the same:
generate first, write the rest, then validate and correct. The local developer's tools (`developer_*`) are on
standby with the local models ([ADR-platform-0013](../../docs/03-adr/0013-local-models-on-standby.md)): `LOCAL_MODELS`
in `server.nuc`, held to `localModels` of Nuclear Builder's `setup.json` by a test.

## Stack

- A Nuclear project of its own, the `python` dialect (`nuclear.toml`): the `.nuc` files are the source,
  `nuclear build .` writes the Python package `build/nuclear_mcp`, which `pyproject.toml` packages (command
  `nuclear-mcp` = `nuclear_mcp.cli:main`).
- The `mcp` Python library (`mcp>=2.3`), `httpx` for the Nuclear Developer and the internet, and the Smart Graph's
  package `nuclear-graph` (from `../../nuclear-graph-storage`, editable): its `GraphClient`, `Toolchain` and `Web`.
- It needs the installed `nuclear` command; `nuclear-builder` for the specs, the teams and `developer_task` /
  `developer_retry`.

## Commands

```sh
cd tools/mcp
nuclear check . && nuclear build .            # the .nuc files → build/nuclear_mcp
uv sync --extra test
.venv/bin/python -m pytest -q                 # tests/*.nuc
nuclear-mcp                                   # the server on stdio (a client starts it); --informs: Atlas's tools only; --skip a,b: without those tools
nuclear-mcp tools                             # its instructions and tools as JSON (what the knowledge base reads)
uv tool install tools/mcp                     # from the tree's root, after the build: what the AI set-up does
claude mcp add --scope user nuclear -- nuclear-mcp
nuclear-graph connect mcp --scopes read,write # allow MCP clients to read the graph
```

## Folders

- `server.nuc`: the server, its instructions (`FIRST`) and every tool (`McpTools`, `mcpServer`, `mcpTools`,
  `remoteOnly`); `nuclearStart` and `nuclearDoc` teach Nuclear.
- `work.nuc`: the tools of the user's work (`WorkTools`: `workspace_*`, `app_*`, `project_migrate`, `spec_*`,
  `team_*`, `member_*`, `skills_set`), each a call of `nuclear workspace` or `nuclear-builder` (`runCommand`), and the confirmation every
  change goes through (`confirmed`); `projectOf`.
- `migration.nuc`: `migration_inspect`'s inventory of an original project in another technology (read-only).
- `cli.nuc`: `nuclear-mcp` and `nuclear-mcp tools`. `__init__.nuc`: the package's name.
- `tests/`: `test_server.nuc`, `test_work.nuc` (the work's tools with a fake command runner and a fake client) and
  `support.nuc` (`expect`).
- `defs/python/nuclear_graph/0.2.0/`: the type definitions of the graph's package the server imports (generated:
  regenerate them when the graph's `client`, `toolchain`, `paths`, `web` or `workspace` change).
- `docs/`: this project's documents (the table below).

## Rules

1. **An agent with no context learns Nuclear from this server alone** (spec 016, root rule 14): the instructions
   send it to `nuclear_start`, whose answer and every `nuclear_doc` come from the installed `nuclear` (never a path
   of the source tree). Every project created with Nuclear gets its context documents and an `AGENTS.md` section
   that names this server ([the CLI's agent support](../cli/docs/02-architecture/agent-support.md)).
2. **A tool is a method with a comment**: the comment is the description the client reads. A tool added, renamed or
   given a parameter is also added to [the guide](docs/08-guides/mcp.md) (a test holds it to the server's list), and
   the knowledge base is rebuilt (the graph keeps a row per tool, `mcp:<tool>`, read with `nuclear-mcp tools`).
3. **A generator tool is a `nuclear gen` command**, never its own code: the options and the refusals are the
   [code generator's](../code_generator/AGENTS.md).
4. **The `nuclear_project` tool runs only the commands of its list** (`PROJECT_COMMANDS`). A command that changes
   a database is not in it: `nuclear migrate` is `project_migrate`, which asks the user first (rule 7).
5. **The graph is reached with the token of the client `mcp`**: the user decides whether MCP clients may read it.
   Never weaken that to make a tool easier.
6. **No `developer_*` tool while `LOCAL_MODELS` is false**, and a machine set up for remote agents only gets none
   either; the `graph_*` tools are on every machine. A new tool that needs the graph or the local developer takes one
   of those prefixes.
9. **What an agent needs on a project has its tool** (ADR-platform-0014): building, checking, generating, the
   migrations of a database (`project_migrate`), the tests (`project_test`). A capability added to `nuclear` for a
   project gets its tool in the same change, with an answer that is the same in every dialect.
7. **Every tool that changes the user's work asks the user first** (`confirmed`): MCP elicitation, or a preview
   with a `confirm` token (bound to the tool and its exact arguments, 5 minutes, once, kept in the process only).
   A tool never changes anything before that yes, and never deletes a folder unless its argument says so.
8. **What comes from the internet is untrusted text**: no code blocks, and never a page of this machine or the
   local network.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is untested or pending in the server |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change the server: how a tool is declared, the two modes, the instructions, what each group of tools needs, its settings |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why there is an MCP server and what it exposes |
| [docs/08-guides/mcp.md](docs/08-guides/mcp.md) | You need what a user reads: the set-up of each client, how a model works with the server, every tool and its parameters, what to do when a tool fails |
| [docs/08-guides/walkthrough-rick-and-morty.md](docs/08-guides/walkthrough-rick-and-morty.md) | You need every call an agent makes and every answer of the server for one real request (backend, web and mobile over a public API), and how to talk to the server by hand |

Elsewhere:

- The Smart Graph, its `Toolchain` and `Web`, and the strategies `graph_strategy` answers:
  [nuclear-graph-storage](../../nuclear-graph-storage/AGENTS.md).
- The local developer behind `developer_*`: [nuclear-agents](../../nuclear-agents/AGENTS.md).
- The set-up that installs the server and chooses the mode:
  [the AI services' guide](../../installer/docs/08-guides/ai-setup.md).
