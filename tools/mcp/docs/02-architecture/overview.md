---
status: accepted
owner: Julian Molina
updated: 2026-11-20
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
        │           ──► nuclear workspace …                  the workspaces and their apps
        │           ──► nuclear-builder spec|team …          the specs, the teams and their members
        │           ──► nuclear-builder run|retry|restart a whole task by the local agents (on standby)
        │ HTTP      ──► Nuclear Developer (127.0.0.1:7879)   one file, its tests, its security findings (on standby)
        │ HTTP      ──► Smart Graph (127.0.0.1:7878)         strategy, exact answers, search, memory
        └────────────► the internet                          an API's answer, its documentation
```

| Tools | They need |
|---|---|
| `project_inspect`, `generate_*`, `nuclear_*` (`nuclear_project` among them) | only the installed `nuclear` command |
| `workspace_*`, `app_*` | the installed `nuclear` with `nuclear workspace` |
| `spec_*`, `team_*`, `member_*`, `skills_set` | the installed `nuclear-builder` |
| `api_inspect`, `web_search`, `web_read` | the internet |
| `graph_*` | the Smart Graph, which every profile of the set-up installs and starts |
| `developer_*` (on standby: not registered) | the Nuclear Developer, the graph and Ollama with the profile's models; `developer_task` and `developer_retry` also `nuclear-builder` |

## How a tool is declared

- `McpTools(graph: GraphClient, tools: Toolchain, web: Web)` holds every tool. **Each method with a comment is a
  tool, and the comment is what the client reads of it.** The method `graphSearch` is the tool `graph_search`.
- `all()` lists the tools in the order a client sees them: the graph's, the compiler's, `nuclear_project`,
  the generators, the internet, the developer's.
- `WorkTools(runner)` (`work.nuc`) holds the tools of the user's work, the same way; `runner` runs a command
  (`runCommand`: stdin, stdout, at most 600 s) and a test gives its own.
- `mcpServer()` makes the server `nuclear` with its instructions and adds each tool of `McpTools.all()` and
  `WorkTools.all()`.
- `mcpTools()` gives the instructions and the tools as data (`{instructions, tools: [{name, description, schema}]}`)
  to the knowledge base's build (it runs `nuclear-mcp tools`), so the graph has a row per tool (`mcp:<tool>`) and
  answers "which tools" exactly.
- This is the pattern of an MCP server written in Nuclear: the Builder's, `nuclear-builder mcp`, is made the same way
  (its own project, [actions.md](../../../../extensions/tools/nuclear-builder/docs/02-architecture/actions.md)).

## The local models on standby

`LOCAL_MODELS` (`false`, [ADR-platform-0013](../../../../docs/03-adr/0013-local-models-on-standby.md)) mirrors
`localModels` of Nuclear Builder's `setup.json` (a test holds them equal). `localDeveloper()` is `LOCAL_MODELS` and a
machine not of remote agents only: while it is false, `mcpServer()` registers no `developer_*` tool and
`nuclear_start` answers the remote cycle, whatever the machine's mode. The developer's tools stay in the code; turning
them on again is the user's decision (`LOCAL_MODELS = true` with `localModels: true`, and their own tests that day).

## Two modes (with the local models on)

`remoteOnly()` reads `NUCLEAR_AI_MODE`, else the mode of the machine's `ai.env` (`~/.config/nuclearlang/ai.env`,
`%APPDATA%\nuclearlang\ai.env`), else `local`.

| Mode | Tools | Instructions |
|---|---|---|
| `local` | all | `FIRST` + `LOCAL_FIRST`: call `nuclear_start` before anything about Nuclear, then `graph_strategy` |
| `remote` (remote agents only) | every tool whose name does not start with `developer_` (the Smart Graph runs in every profile, ADR-installer-0004) | `FIRST` + `LOCAL_FIRST`, as local |

The instructions only say where to begin (spec 016: an agent with no context learns Nuclear from this server).
The work cycle is part of `nuclear_start`'s answer: local, `graph_strategy` + `GENERATORS` + `LOCAL` (generate; give
`developer_task` only what is left; wire with `generate_usecase`; validate; correct only what failed;
`developer_review`); remote, `REMOTE_NOTE` + `graph_strategy` + `GENERATORS` + `REMOTE` (generate; the model writes what is left
after reading `nuclear_brief`, the graph and `nuclear_help`; validate and correct). `nuclear_start` itself is `nuclear help start`, that
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

## The user's work and its confirmation (spec 022)

- **Workspaces and apps**: `workspace_create` → `nuclear workspace new <path> [--name] [--description] --json`;
  `workspace_show`, `workspace_edit`, `app_add`, `app_rename`, `app_remove` → `nuclear workspace show|edit|add|rename|remove …
  --json`, run in the folder given (the CLI finds the workspace that holds it). `workspace_delete` reads `show`,
  removes each app with `remove <app> --delete` only with `delete_folders`, then removes the marker
  `.workspace/workspace.nuc` (and `.workspace/` when empty) itself: the CLI has no `workspace delete` yet.
- **Specs**: `spec_create`, `spec_list`, `spec_show`, `spec_edit` → `nuclear-builder spec new|list|show|update …
  --json` in the project (`projectOf`), so the spec is where Nuclear Builder reads it.
- **Teams**: `team_list`, `team_show`, `team_create` (the draft on stdin), `team_edit` (`team update`), `team_delete`,
  `member_add`, `member_edit` (`team member update`), `member_remove`, `skills_set` (`team skills set`). A member of
  the local kind is refused before the command (`LOCAL_STANDBY`).
- A name, an id or a path that starts with `-` is refused (it would be read as an option); free text never starts
  with `--`.
- **`confirmed(ctx, tool, args, change, confirm)`**, before every change: with `confirm`, the token must be one of
  `PENDING` (the server process's memory), not expired (`CONFIRM_MS`, 5 minutes) and bound to `tool` and these exact
  arguments (`changeKey`); it is used up either way. Without it, a client that declared `elicitation` and has a
  channel back (`canAsk`) is asked `change` + "Do it?" with one boolean (`YES_SCHEMA`): only an accepted `true` goes
  on, anything else answers `{declined, changed: "nothing"}`. Otherwise (or when the question fails) the tool answers
  `{preview, changed: "nothing yet", confirm, expiresInSeconds, next}` and runs nothing.

## Settings

| Variable | Default |
|---|---|
| `NUCLEAR_AI_MODE` | the mode of the machine's `ai.env`, else `local` |
| `NUCLEAR_DEVELOPER_URL` | `http://127.0.0.1:<port>`: `NUCLEAR_DEVELOPER_PORT` of `ai.env` (the port the set-up chose), else `7879` |
| `NUCLEAR_GRAPH_URL` / `NUCLEAR_GRAPH_PORT` | `http://127.0.0.1:7878` / `7878` |
| `NUCLEAR_SEARXNG_URL` | none (Brave with a key, else Wikipedia) |

## Installed alone

Every machine runs the server and the Smart Graph (ADR-installer-0004), but no local developer (on standby); the graph's package comes with the server, for `GraphClient`, `Toolchain` and `Web`.

## Tests (`tests/test_server.nuc`; `nuclear build . && .venv/bin/python -m pytest -q`)

- `testTheMcpServerOffersItsToolsAndNoneOfTheLocalOnesWhileTheLocalModelsAreOnStandby`: in the local and the remote
  mode the server offers `nuclear_start` first, `graph_strategy` and the generators, and none of `developer_*`; every
  tool is named in the guide of the server (`docs/08-guides/mcp.md`).
- `testTheLocalModelsSwitchMirrorsNuclearBuildersSetup`: `LOCAL_MODELS` equals `localModels` of
  `extensions/tools/nuclear-builder/setup.json` (only in the working tree).
- `testAnAgentWithNoContextLearnsNuclearFromNuclearStart`: `nuclear_start` teaches Nuclear and never names
  `developer_task` or `developer_review`.
- `testASpecIsLedByTheLocalAgentsAndAnApisAnswerIsShownAsAShape`: `specMarkdown` and `shape`.
- `tests/test_work.nuc`: a change asked by elicitation is done only on a yes (declined, cancelled, unticked: nothing
  runs); through the MCP library's own client (elicitation accepted, declined, absent); a client that cannot ask gets
  a preview and a token for that exact change, once (another change's token, a used one, an expired one, an unknown
  one: refused); `workspace_delete` removes the marker and the apps' folders only when asked; the apps', specs' and
  teams' tools call their commands with the right arguments, folder and stdin, and never hire a local member; the
  real `nuclear workspace` (skipped while the installed `nuclear` has none).
