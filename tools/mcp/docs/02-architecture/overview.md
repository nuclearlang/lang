---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [tools/mcp/server.nuc, tools/mcp/cli.nuc, nuclear-graph-storage/toolchain.nuc, nuclear-graph-storage/web.nuc, tools/mcp/docs/08-guides/mcp.md]
---
# The MCP server: overview

`nuclear-mcp` serves MCP over stdio until the client closes it (`main` in `cli.nuc` → `mcpMain` →
`mcpServer().run()` in `server.nuc`); `nuclear-mcp tools` prints `mcpTools()` as JSON. What each tool does for a user is in [the guide](../08-guides/mcp.md).

## What it stands on

```
 Claude Code / Codex / Cursor / OpenCode
        │ MCP (stdio)
        ▼
   nuclear-mcp ──────► nuclear                       the compiler, the command line, the generators
        │           ──► nuclear-builder run|retry|restart a whole task by the local agents
        │ HTTP      ──► Nuclear Developer (127.0.0.1:7879)   one file, its tests, its security findings
        │ HTTP      ──► Smart Graph (127.0.0.1:7878)         strategy, exact answers, search, memory
        └────────────► the internet                          an API's answer, its documentation
```

| Tools | They need |
|---|---|
| `project_inspect`, `generate_*`, `nuclear_*` (`nuclear_project` among them) | only the installed `nuclear` command |
| `api_inspect`, `web_search`, `web_read` | the internet |
| `graph_*` | the Smart Graph, which a local profile of the set-up installs and starts |
| `developer_*` | the Nuclear Developer, the graph and Ollama with the profile's models; `developer_task` and `developer_retry` also `nuclear-builder` |

## How a tool is declared

- `McpTools(graph: GraphClient, tools: Toolchain, web: Web)` holds every tool. **Each method with a comment is a
  tool, and the comment is what the client reads of it.** The method `graphSearch` is the tool `graph_search`.
- `all()` lists the tools in the order a client sees them: the graph's, the compiler's, `nuclear_project`,
  the generators, the internet, the developer's.
- `mcpServer()` makes the server `nuclear` with its instructions and adds each tool of `all()`.
- `mcpTools()` gives the instructions and the tools as data (`{instructions, tools: [{name, description, schema}]}`)
  to the knowledge base's build (it runs `nuclear-mcp tools`), so the graph has a row per tool (`mcp:<tool>`) and
  answers "which tools" exactly.
- This is the pattern of an MCP server written in Nuclear: the Builder's, `nuclear-builder mcp`, is made the same way
  (its own project, [actions.md](../../../../extensions/tools/nuclear-builder/docs/02-architecture/actions.md)).

## Two modes

`remoteOnly()` reads `NUCLEAR_AI_MODE`, else the mode of the machine's `ai.env` (`~/.config/nuclearlang/ai.env`,
`%APPDATA%\nuclearlang\ai.env`), else `local`.

| Mode | Tools | Instructions |
|---|---|---|
| `local` | all | `FIRST` + `LOCAL_FIRST`: call `nuclear_start` before anything about Nuclear, then `graph_strategy` |
| `remote` (remote agents only) | every tool whose name does not start with `graph_` or `developer_` | `FIRST`: call `nuclear_start` before anything about Nuclear |

The instructions only say where to begin (spec 016: an agent with no context learns Nuclear from this server).
The work cycle is part of `nuclear_start`'s answer: local, `graph_strategy` + `GENERATORS` + `LOCAL` (generate; give
`developer_task` only what is left; wire with `generate_usecase`; validate; correct only what failed;
`developer_review`); remote, `REMOTE_NOTE` + `GENERATORS` + `REMOTE` (generate; the model writes what is left after
reading `nuclear_brief` and `nuclear_help`; validate and correct). `nuclear_start` itself is `nuclear help start`, that
cycle and `nuclear help atlas`; with a project, `gen inspect` and the brief of its dialect. `nuclear_doc` is `nuclear
help <topic>`. `developer_task` first asks the local developer whether it answers (`developerDown`): when it does
not, it says how to start it and that the model writes the code itself meanwhile. `FIRST` also holds the rule that a
product is made with these tools: no target code for a feature, no native code translated into Nuclear by hand
([ADR-platform-0004](../../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## The groups

- **Generators.** Each runs a `nuclear gen` command in the project (`project_inspect` → `gen inspect`,
  `generate_component`, `generate_resource`, `generate_usecase`); `generate_screen` runs `nuclear make screen`;
  `api_inspect` fetches a url and answers the shape of its JSON (`shape`, `shapeKind`: one key per line, a nested
  object indented, a list by its first item) and, with a project, the files `generate_resource` would write.
- **The compiler and the command line** (`Toolchain` of the graph's package,
  `nuclear-graph-storage/toolchain.nuc`): `check` and `build` of a piece of Nuclear, `checkProject`, `fmt`, `help`,
  `brief`, `layout` / `pathOf`, and `project(root, args)`, which runs `nuclear <args>`. A name such as `backend` is
  passed as `--platform`, any other as `--dialect` (`target`). Answers are short texts: `ok`, or
  `line:col CODE message (fix: ...)` per error (`describe`). The `nuclear_project(project, command, args)` tool
  refuses a command that is not in `PROJECT_COMMANDS` (`new`, `n`, `build`, `install`, `test`, `check`, `analyze`,
  `make`, `g`, `gen`, `migrate`, `add`, `remove`, `explain`).
- **The local developer.** `developer_task` finds the project (`projectOf`: the closest folder up with a
  `config.nuc`), writes `specs/<run>/spec.md` (`specMarkdown`: led by the local agents; the run's name is
  `taskSlug(title)`), runs `nuclear-builder run <spec> --lead local` and answers the journal
  `.nuclear/builder/runs/<run>.md`. `developer_retry` runs `nuclear-builder retry <run> [--step <id> | --from <stage>]`,
  or `nuclear-builder restart <run>` for a run from scratch. `developer_review` appends the lead's notes to
  `<run>.review.md` and, when the project's check is `ok`, keeps each corrected `.nuc` file of the project with its
  task in the graph's `examples`. `developer_code`, `developer_test` and `developer_security` post to the Nuclear
  Developer over HTTP (`developer(path, body)`).
- **The Smart Graph** (`GraphClient("mcp")`): `graph_strategy`, `graph_answer`, `graph_search`, `graph_card`,
  `graph_prompt`, `graph_remember`, with the token of the client `mcp`.
- **The internet** (`Web` of the graph's package, `nuclear-graph-storage/web.nuc`): `web_search` uses the first
  engine available: a SearXNG of the user's own (`NUCLEAR_SEARXNG_URL`), Brave Search with the key kept by
  `nuclear-graph web-key brave`, else Wikipedia (no key). `web_read` gives a page as plain text. Code blocks are removed (what comes back is facts for the business
  logic, never code: the agents keep writing only Nuclear), and a url whose host resolves to this machine or the
  local network is refused (`publicUrl`): the graph and the Developer listen on 127.0.0.1.

## Settings

| Variable | Default |
|---|---|
| `NUCLEAR_AI_MODE` | the mode of the machine's `ai.env`, else `local` |
| `NUCLEAR_DEVELOPER_URL` | `http://127.0.0.1:<port>`: `NUCLEAR_DEVELOPER_PORT` of `ai.env` (the port the set-up chose), else `7879` |
| `NUCLEAR_GRAPH_URL` / `NUCLEAR_GRAPH_PORT` | `http://127.0.0.1:7878` / `7878` |
| `NUCLEAR_SEARXNG_URL` | none (Brave with a key, else Wikipedia) |

## Installed alone

A machine set up for remote agents only installs the server (`uv tool install tools/mcp`) and not the graph's
server extra (ADR-installer-0002); the graph's package still comes with it, for `GraphClient`, `Toolchain` and `Web`.

## Tests (`tests/test_server.nuc`; `nuclear build . && .venv/bin/python -m pytest -q`)

- `testTheMcpServerOffersItsToolsAndNoneOfTheLocalOnesToAMachineOfRemoteAgents`: the local mode offers the tools;
  every tool is named in the guide of the server (`docs/08-guides/mcp.md`); the remote mode
  offers more than ten tools and none of `graph_*` / `developer_*`.
- `testASpecIsLedByTheLocalAgentsAndAnApisAnswerIsShownAsAShape`: `specMarkdown` and `shape`.
