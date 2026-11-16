---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [nuclear-graph-storage/mcp_server.nuc, nuclear-graph-storage/toolchain.nuc, nuclear-graph-storage/web.nuc, tools/mcp/docs/08-guides/mcp.md]
---
# The MCP server: overview

`nuclear-graph mcp` serves MCP over stdio until the client closes it (`mcpMain` → `mcpServer().run()` in
`nuclear-graph-storage/mcp_server.nuc`). What each tool does for a user is in [the guide](../08-guides/mcp.md).

## What it stands on

```
 Claude Code / Codex / Cursor / OpenCode
        │ MCP (stdio)
        ▼
   nuclear-graph mcp ──► nuclear, dragonfly           the compiler, the command line, the generators
        │           ──► nuclear-loop run|retry|restart a whole task by the local agents
        │ HTTP      ──► Nuclear Developer (127.0.0.1:7879)   one file, its tests, its security findings
        │ HTTP      ──► Smart Graph (127.0.0.1:7878)         strategy, exact answers, search, memory
        └────────────► the internet                          an API's answer, its documentation
```

| Tools | They need |
|---|---|
| `project_inspect`, `generate_*`, `nuclear_*`, `dragonfly` | only the installed `nuclear` and `dragonfly` commands |
| `api_inspect`, `web_search`, `web_read` | the internet |
| `graph_*` | the Smart Graph, which a local profile of the set-up installs and starts |
| `developer_*` | the Nuclear Developer, the graph and Ollama with the profile's models; `developer_task` and `developer_retry` also `nuclear-loop` |

## How a tool is declared

- `McpTools(graph: GraphClient, tools: Toolchain, web: Web)` holds every tool. **Each method with a comment is a
  tool, and the comment is what the client reads of it.** The method `graphSearch` is the tool `graph_search`.
- `all()` lists the tools in the order a client sees them: the graph's, the compiler's, `dragonfly`, the
  generators, the internet, the developer's.
- `mcpServer()` makes the server `nuclear` with its instructions and adds each tool of `all()`.
- `mcpTools()` gives the instructions and the tools as data (`{instructions, tools: [{name, description, schema}]}`)
  to the knowledge base's build, so the graph has a row per tool (`mcp:<tool>`) and answers "which tools" exactly.

## Two modes

`remoteOnly()` reads `NUCLEAR_AI_MODE`, else the mode of the machine's `ai.env` (`~/.config/nuclearlang/ai.env`,
`%APPDATA%\nuclearlang\ai.env`), else `local`.

| Mode | Tools | Instructions |
|---|---|---|
| `local` | all | `LEAD` + `GENERATORS` + `LOCAL`: call `graph_strategy` first; generate; give `developer_task` only what is left; wire with `generate_usecase`; validate; correct only what failed; `developer_review` |
| `remote` (remote agents only) | every tool whose name does not start with `graph_` or `developer_` | `REMOTE_LEAD` + `GENERATORS` + `REMOTE`: generate; the model writes what is left after reading `nuclear_brief` and `nuclear_help`; validate and correct |

The generators' part of the instructions (`GENERATORS`) is the same in both.

## The groups

- **Generators.** Each runs a `dragonfly gen` command in the project (`project_inspect` → `gen inspect`,
  `generate_component`, `generate_resource`, `generate_usecase`); `generate_screen` runs `dragonfly make screen`;
  `api_inspect` fetches a url and answers the shape of its JSON (`shape`, `shapeKind`: one key per line, a nested
  object indented, a list by its first item) and, with a project, the files `generate_resource` would write.
- **The compiler and the command line** (`Toolchain`, `toolchain.nuc`): `check` and `build` of a piece of Nuclear,
  `checkProject`, `fmt`, `help`, `brief`, `layout` / `pathOf`, and `dragonfly(root, args)`. A name such as `backend`
  is passed as `--platform`, any other as `--dialect` (`target`). Answers are short texts: `ok`, or
  `line:col CODE message (fix: ...)` per error (`describe`). The `dragonfly` tool refuses a command that is not in
  `DRAGONFLY_COMMANDS` (`new`, `n`, `build`, `install`, `test`, `check`, `analyze`, `make`, `g`, `gen`, `migrate`,
  `add`, `remove`, `explain`).
- **The local developer.** `developer_task` finds the project (`projectOf`: the closest folder up with a
  `config.nuc`), writes `specs/<run>/spec.md` (`specMarkdown`: led by the local agents; the run's name is
  `taskSlug(title)`), runs `nuclear-loop run <spec> --lead local` and answers the journal
  `.nuclear/loop/runs/<run>.md`. `developer_retry` runs `nuclear-loop retry <run> [--step <id> | --from <stage>]`,
  or `nuclear-loop restart <run>` for a run from scratch. `developer_review` appends the lead's notes to
  `<run>.review.md` and, when the project's check is `ok`, keeps each corrected `.nuc` file of the project with its
  task in the graph's `examples`. `developer_code`, `developer_test` and `developer_security` post to the Nuclear
  Developer over HTTP (`developer(path, body)`).
- **The Smart Graph** (`GraphClient("mcp")`): `graph_strategy`, `graph_answer`, `graph_search`, `graph_card`,
  `graph_prompt`, `graph_remember`, with the token of the client `mcp`.
- **The internet** (`Web`, `web.nuc`): `web_search` uses the first engine available: a SearXNG of the user's own
  (`NUCLEAR_SEARXNG_URL`), Brave Search with the key kept by `nuclear-graph web-key brave`, else Wikipedia (no
  key). `web_read` gives a page as plain text. Code blocks are removed (what comes back is facts for the business
  logic, never code: the agents keep writing only Nuclear), and a url whose host resolves to this machine or the
  local network is refused (`publicUrl`): the graph and the Developer listen on 127.0.0.1.

## Settings

| Variable | Default |
|---|---|
| `NUCLEAR_AI_MODE` | the mode of the machine's `ai.env`, else `local` |
| `NUCLEAR_DEVELOPER_URL` | `http://127.0.0.1:7879` |
| `NUCLEAR_GRAPH_URL` / `NUCLEAR_GRAPH_PORT` | `http://127.0.0.1:7878` / `7878` |
| `NUCLEAR_SEARXNG_URL` | none (Brave with a key, else Wikipedia) |

## Installed alone

A machine set up for remote agents only installs the server without the graph's store (`nuclear-graph[mcp]`, 33 MB
instead of 405): ADR-installer-0002.

## Tests (`nuclear-graph-storage/tests/test_agents.nuc`)

- `testTheMcpServerOffersItsToolsAndNoneOfTheLocalOnesToAMachineOfRemoteAgents`: the local mode offers the tools;
  every tool is named in the graph's `README.md` and in the documentation page of the server; the remote mode
  offers more than ten tools and none of `graph_*` / `developer_*`.
- `testASpecIsLedByTheLocalAgentsAndAnApisAnswerIsShownAsAShape`: `specMarkdown` and `shape`.
