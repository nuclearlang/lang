# The MCP server of NuclearLang

MCP is the **Model Context Protocol**: an AI client (Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI) starts a program and calls
the tools it offers. `nuclear-mcp` is that program for NuclearLang. It speaks MCP over stdio and gives a
frontier model three things: the **generators** that write the standard code, the **Smart Graph** to look things up
instead of guessing, and the **compiler** to check everything. The model writes what the generators do not.

The server also tells the model how to work, so every client behaves the same: generate first, write the rest, then
validate and correct.

The local models are **on standby** ([ADR-platform-0013](../../../../docs/03-adr/0013-local-models-on-standby.md)):
the server registers no `developer_*` tool on any machine, and its work cycle never names the local developer.

`nuclear-mcp --informs` is the server of an agent that only informs (Nuclear Atlas, spec 023): it offers only
`INFORM_TOOLS` (`server.nuc`): what teaches Nuclear and reads the projects, workspaces, specs, teams, runs, checks,
skills, the line, the reports and the agents and models, and the team tools that ask first (`team_create`, `team_edit`, `member_add`, `member_edit`); no generator, build, project command,
spec, run, skill or workspace written.

`nuclear-mcp --skip <tool,tool...>` leaves those tools out, with or without `--informs`. Nuclear Builder starts the
server this way for its agents, with the names of the tools its own server (`nuclear-builder mcp`) gives them: each
tool is in the agent's context once (spec 025).

## 1. Set up

The server comes with the AI services: [set them up](../../../../installer/docs/08-guides/ai-setup.md) first (the
set-up also allows MCP clients to read the graph). Then add the server to your client:

```sh
claude mcp add --scope user nuclear -- nuclear-mcp   # Claude Code
codex mcp add nuclear -- nuclear-mcp                 # Codex
```

Cursor reads `~/.cursor/mcp.json`, OpenCode `~/.config/opencode/opencode.json`:

```json
{ "mcpServers": { "nuclear": { "command": "nuclear-mcp" } } }
```

```json
{ "mcp": { "nuclear": { "type": "local", "command": ["nuclear-mcp"], "enabled": true } } }
```

In VS Code, *Settings and integrations* (`Ctrl+Alt+S`) adds it to each client with a button.

Every machine has the Smart Graph and no local developer: the server offers the generators, the compiler, the
command line, the internet tools and the `graph_*` tools, and tells the model to write what the generators do not.

What each group of tools needs running:

| Tools | They need |
|---|---|
| `project_inspect`, `generate_*`, `nuclear_*` | only the installed `nuclear` command |
| `migration_inspect` | nothing: it reads the original project's folder |
| `api_inspect`, `web_search`, `web_read` | the internet |
| `graph_*` | the Smart Graph (127.0.0.1:7878), which the set-up installs and starts |
| `workspace_*`, `app_*` | the installed `nuclear` (`nuclear workspace`) |
| `spec_*`, `team_*`, `member_*`, `skills_set` | the installed `nuclear-builder` |

## 2. How a model works with it

An agent may know nothing about Nuclear: the server's instructions only tell it to call `nuclear_start` before
anything about Nuclear. Its answer is the onboarding (what Nuclear and Synapsis are, the rules never broken, the
work cycle with these tools on this machine) and the atlas of every topic, each read with `nuclear_doc`; with a
project folder, also the project's pieces and the sheet of its dialect. Nothing it reads points into a source tree.

The cycle starts by sizing the request (`nuclear_doc("task-size")`, spec 024): small (≤ 3 files, ≤ 100 lines) and
medium (≤ 10 files, ≤ 400 lines) without a new feature are the model's own work; a new feature, more, or several
specs is proposed to Nuclear Builder (`spec_create`, then `run_start`) with the count as the reason, for the user to
decide.

The work starts from a **workspace** (spec 022): the folder that holds `.workspace/workspace.nuc` and names the apps
of one business project. The model reads it with `workspace_show`; for a new product it creates it
(`workspace_create`) and adds each app (`app_add`), writes each feature as a spec (`spec_create`, shown in Nuclear
Builder at once) and keeps the teams (`team_*`, `member_*`).

**Every change is the user's yes first.** A tool that changes a workspace, an app, a spec or a team asks the user
through the client (MCP elicitation: what will change, yes or no) and changes nothing on a no. A client that cannot
ask gets a preview instead: `{"preview", "changed": "nothing yet", "confirm": "<token>", "expiresInSeconds": 300}`.
The model shows the preview to the user and, only on their yes, calls the same tool again with the same arguments and
`confirm` set to the token. The token is valid once, for 5 minutes, for that tool and those arguments only; any other
call with it is refused and changes nothing.

The cycle then calls `graph_strategy` with the user's own words: it answers which
kind of request it is and the plan of that kind
([the strategies](../../../../extensions/tools/nuclear-builder/docs/08-guides/follow-a-run.md#the-strategy-of-a-request)). For a feature the plan is this order:

1. **Inspect.** `project_inspect`: what the project already has, so nothing is declared twice.
2. **Generate.** For every resource the spec names (a model and what is done with it), `generate_resource`. Its
   fields come from the API's answer (`from_json`; `api_inspect` shows its shape first), from the spec (`from_spec`)
   or from `fields`. When neither gives them, the model looks up the API's documentation (`web_search`, `web_read`)
   and, if it is still unclear, asks the user: it never guesses. A use case that only calls a repository method is
   `generate_usecase` with `calls`.
3. **Write the rest.** What the generators did not write (a use case with its own rules, a view's details): before
   writing `.nuc` the model reads `nuclear_brief` and searches the graph or looks up a word with `nuclear_help`.
4. **Wire.** Each use case it wrote, with `generate_usecase` (its alias in the facade, its route).
5. **Validate.** `nuclear_check` of the project must say `ok` and `nuclear test` must pass.
6. **Correct only what failed**, never what passed.

## 3. The tools

### Generators

They write finished code that compiles, never a skeleton to fill in. Each is a `nuclear gen` command:
[the generators' guide](../../../../nuclear-synapsis-framework/docs/08-guides/generators.md) has the
options, the examples and what each platform gets.

| Tool | What it does |
|---|---|
| `project_inspect(project)` | the project's platform and dialect, its components with their declarations by kind, the generators of its platform |
| `project_monitor(project)` | what the app is doing and where it is slow (Nuclear Monitor): its console (state, requests and errors counted, the last requests, each error with its stack) and, after a run with `nuclear run --monitor` (or `nuclear monitor --on`), the hot spots and the time, calls, connections and memory of each Nuclear function and method |
| `project_run_log(project, lines)` | why the app failed or what it did: the last `lines` (default 200, at most 2000) of the project's `.nuclear/logs/run.log`, which `nuclear run` and the editor's devices write (each step, the build's errors, the server's output, `failed:` and `exited:`); only that file |
| `graph_monitor(project)` | `project_monitor`, and its hot spots kept in the graph (`monitor:<project>`) for later sessions |
| `generate_component(project, component)` | a new component with its facade |
| `generate_resource(project, component, name, from_json \| from_spec \| fields, source, path, actions, screen, plural, dry_run)` | a resource: models, repository, a use case per action, the facade's aliases, the controller (backend) or a screen with its state manager (mobile, web), the tests |
| `generate_usecase(project, component, name, calls, route, dry_run)` | a use case wired into its component: its alias in the facade and, with `route` (backend), its route. With `calls` the use case is written too, because it only calls that repository method; without it the use case is one the project already has |
| `generate_screen(project, component, screen, route)` | mobile and web: a screen with its state manager and state model, for a view that is not a resource's list |
| `migration_inspect(folder)` | read-only: the inventory of an original project in another technology (TypeScript, JavaScript, React, Express, NestJS, Dart, Flutter, Python) to rewrite in Nuclear: each app (a folder with a `package.json`, `pubspec.yaml`, `pyproject.toml` or `requirements.txt`), its language and frameworks, the platform and dialect it becomes, its database plugin, its sources by extension and what becomes of each dependency; then `graph_strategy("migrate a project into Nuclear")` |
| `api_inspect(url, project, component, name)` | the shape of a public API's JSON answer; with a project, the files `generate_resource` would write from it |

```
generate_resource(project, "orders", "Order", fields="id:int total:double status:string", source="db")
generate_usecase(project, "orders", "PageOrders", calls="OrderRepository.page", route="GET orders/pages/{page}")
generate_usecase(project, "orders", "CancelOrder", route="POST orders/{id}/cancel")   # CancelOrder is in the project
```

Nothing is overwritten and nothing is declared twice; `dry_run` shows the files first. A generator that cannot write
something finished refuses and says what to do: `generate_usecase` without `calls`, for a use case the project does
not declare, answers where to write it.

### The local developer (on standby)

Registered only when the local models are on again (ADR-platform-0013): today no machine has these tools.

| Tool | What it does |
|---|---|
| `developer_task(project, title, description, criteria, use_case)` | **the first step of every task that writes `.nuc`**: the local agents do the whole task in the project (plan, tests first, code, verification, security, artifacts) and answer the run's journal. `use_case`: `feature`, `bug`, `refactor`, `test` |
| `developer_retry(project, run, from_stage, from_step, scratch)` | a run again: from the step that failed, every step that passed kept; the whole of `from_stage`; from one step (`from_step`: its id in the journal, passed or failed) and every step after it; or from scratch (`scratch`: every stage again). What the steps left out wrote is undone first |
| `developer_review(project, run, notes, files)` | **the last step**: the lead's corrections, kept in the journal; each corrected file goes to the graph's examples |
| `developer_code(task, platform, path, kind, context, project)` | one `.nuc` file outside a task, written, checked and repaired by the local model. It returns the file; it does not write it |
| `developer_test(task, code, platform)` | the Nuclear tests of a piece of code |
| `developer_security(code, platform)` | the security findings of a piece of code |

### The Smart Graph

| Tool | What it does |
|---|---|
| `graph_strategy(request, platform)` | **the first call for any request**: which kind of request it is (a whole system, a component, one screen, a use case, a rename, a failing test, a question...), the signs that say so, and the plan of that kind, step by step with the tool of each step |
| `graph_answer(question, platform)` | the exact answer of a question that has one (every command of a tool, the tools of this server and their parameters, the commands that write a kind, a diagnostic by its code, the stages of the Builder, a version...): the rows of the graph's database, whole, never recalled; then the cards the shelves answer by meaning. For "which", "list", "what are the" questions |
| `graph_search(query, shelf, k, platform, kind, type)` | the cards that answer a question, by meaning and by exact name (a diagnostic code, a command, a kind), each with the rows it links to. `shelf`: `concepts`, `language`, `platforms`, `tools`, `errors`, `capabilities`, `playbooks`, `examples`, `docs`, `memory`; empty searches all |
| `graph_card(id)` | one row by its id: `error:N0114`, `kind:backend.usecase`, `tool:nuclear.gen.usecase`, `mcp:generate_usecase`, `playbook:add-a-use-case` |
| `graph_prompt(use_case)` | the validated prompt of `feature`, `refactor`, `bug`, `docs`, `diagram`, `test`, `security`, `piece`, `plan` |
| `graph_remember(id, text, collection, project)` | keeps a decision (`memory`) or a solved example (`examples`) for later sessions |

### The compiler and the command line

| Tool | What it does |
|---|---|
| `nuclear_start(project?)` | **first**: what Nuclear is, the rules, the work cycle on this machine, the atlas of every topic; with a project folder, its pieces and the sheet of its dialect |
| `nuclear_doc(topic, section?)` | one topic of the atlas (a long one answers its sections with their sizes first; `section`, words of a heading, answers that section whole): a guide chapter, `base`, `library`, a platform, a dialect, a tool, `context-docs`, `example/<name>`; a word that is not a topic answers the topics that explain it |
| `nuclear_check(code \| path, dialect)` | `ok`, or one line per error with its fix, for a piece of Nuclear or a whole project |
| `nuclear_build(code, dialect)` | what a piece of Nuclear becomes in the dialect's language |
| `nuclear_fmt(code)` | the piece in the canonical layout |
| `nuclear_help(word, dialect)` | the documentation of a kind, a decorator, a topic or a command |
| `nuclear_brief(platform?, dialect?, full?)` | the short sheet of Nuclear and a platform (or a dialect): read before writing `.nuc` by hand. Its base language part comes only in the first sheet of a session; `full = true` repeats it |
| `nuclear_defs(name, dialect, project?)` | a declaration of the type definitions (a class or `Class.member` of a library); with the project's folder, also of a package the project added (`nuclear_project` with `add`) |
| `nuclear_project(project, command, args)` | `new`, `build`, `install`, `test`, `check`, `analyze`, `make`, `gen`, `add`, `remove`, `explain` in a project (`add` with a name: a package of the target and its type definitions) |
| `project_test(project)` | the tests of a project, written in Nuclear (`nuclear test`: built, then run by its dialect's runner). The same answer in every dialect: `{ok, passed, failed, failures: [{file, line, name}], hint, output}`: where each failure is in the `.nuc`, and what it means (`nuclear explain`). Run it after every change |
| `projects_list()` | every Nuclear project of this machine, whatever its workspace, and where it runs in development (`nuclear projects --json`): `{file, projects: [{name, root, platform, dialect, workspace, url, scheme, host, port}]}`. A project's port never moves by itself (the dialect's, or the project's `PORT`) and is the one `nuclear run` uses; only the user's projects are listed (no temporary folder, no project of Nuclear's own); a backend run in development lets these addresses and any port of `localhost`, `127.0.0.1`, `[::1]` call it from a browser (CORS). Read it to know which port a backend uses, or why a browser app says it has no connection to its server |
| `project_migrate(project, action, message, to, confirm, fake, transaction, rename)` | the migrations of a backend project's database (`nuclear migrate`, the same in every backend dialect): `status` (every migration, applied or pending), `make` (`message`: one migration, the entities minus the last one; it warns of every drop; `rename`: the tables and columns that were renamed, each `<table>=<new table>` or `<table>.<column>=<new column>` in the database's names, written as a rename that keeps the rows), `up` (the pending ones; `to`: up to that migration), `down` (the last one applied; `to`: back to that migration); `fake` (`up`, `down`): only the history changes and nothing runs (a database that already has its tables is brought under the migrations); `transaction` (`up`, `down`): `all` (the default), `each` or `none`. `make`, `up` and `down` ask the user first (`confirm`: the preview's token, for a client that cannot ask): `up` and `down` change the database of the project's active environment, and `down` drops what the migration made, with its data. Answers `{ok, action, output}` |
| `nuclear_env(project, action, name, value, env, local, secret)` | the environments of a project (spec 021): `list` (every `env()` of the code × every environment, as JSON; a secret never shows its value), `envs`, `set` (into `.env`, or `.env.<env>` with `env`; `local`: the `.local` file), `unset`, `use` (the active environment). A secret is never set through the server: the user runs `nuclear env set NAME --secret --env <environment>` in a terminal |

### Workspaces and apps

Each is a `nuclear workspace … --json` command. `workspace` is the workspace's folder or any folder inside it. Every
tool but `workspace_show` asks the user first (`confirm`: the preview's token, for a client that cannot ask).

| Tool | What it does |
|---|---|
| `workspace_create(path, name, description, confirm)` | the folder and its marker `.workspace/workspace.nuc` (`nuclear workspace new`) |
| `workspace_show(workspace)` | `{root, name, description, apps: [{name, folder, platform, dialect, exists}]}` |
| `workspace_edit(workspace, name, description, confirm)` | the workspace's name or description (`nuclear workspace edit`) |
| `workspace_delete(workspace, delete_folders, confirm)` | removes the marker; the apps' folders stay unless `delete_folders` is true (then each app is removed with `nuclear workspace remove <app> --delete`); the question says which |
| `app_add(workspace, app, platform, dialect, confirm)` | an app made by `nuclear new` inside the workspace and named in the marker (`mobile`, `web`, `backend`) |
| `app_rename(workspace, app, new_name, confirm)` | `nuclear workspace rename <app> <new>` |
| `app_remove(workspace, app, delete_folder, confirm)` | the marker stops naming the app; its folder is deleted only with `delete_folder` true |

### Specs

Each is a `nuclear-builder spec … --json` command in the project: the spec lives where Nuclear Builder reads it
(`specs/<component>/[<layer>/]<id>/spec.md`).

| Tool | What it does |
|---|---|
| `spec_create(project, component, title, criteria, layer, use_case, description, text, language, confirm)` | a new spec (`spec new`): its acceptance criteria are required (or `text`, the whole markdown); `language` (en, es...) is asked of the user for the first spec of a project (the editor's offered) and kept; asks the user first |
| `spec_list(project)` | the specs by component and layer, with their runs |
| `spec_show(project, id)` | a spec's markdown, what it says, its draft, its run's status |
| `spec_edit(project, id, text, confirm)` | the spec's whole new markdown over it (`spec update <id> --stdin`); asks the user first |
| `spec_move(project, id, component, layer, confirm)` | the spec's folder to another component or layer, its run following (`spec move`); asks first |
| `spec_migrate(project, confirm)` | the specs of the flat `specs/<id>/` to their component (`spec migrate`); asks first |
| `spec_delete(project, id, confirm)` | the spec's folder to `.nuclear/builder/deleted/` (`spec delete`); asks first |
| `spec_accept(project, id, confirm)`, `spec_discard(project, id, confirm)` | a draft a member wrote in Nuclear Chat (`spec.draft.md`) over the spec, or thrown away; asks first |

### Teams and members

Each is a `nuclear-builder team …` command; a member is never of the local kind (the local models are on standby).
Every tool but `team_list` and `team_show` asks the user first.

| Tool | What it does |
|---|---|
| `team_list()` | the teams |
| `team_show(team)` | a team, its members, purpose, skills, tech lead, budget |
| `team_create(name, purpose, description, skills, members, budget_usd, method, instructions, kind, provider, model, confirm)` | `team create` with the draft on stdin; `members`: `[{role, employee, kind, provider, model, name}]`; `method` (empty: Scrum) and `instructions` every member follows; `kind`/`provider`/`model`: the team's model, the draft's `brain`, which works every member without its own |
| `team_edit(team, name, description, purpose, skills, lead, budget_usd, method, instructions, kind, provider, model, confirm)` | `team update` (`--method`, `--instructions`, `--kind --provider --model`: the team's model puts every member on it) |
| `team_delete(team, confirm)` | `team delete` (the file kept as `<id>.json.bak`) |
| `member_add(team, role, employee, kind, provider, model, name, count, confirm)` | `team member add` |
| `member_edit(team, member, kind, provider, model, employee, name, instructions, temperament, skills, extra_skills, gifs, note, agent, team_brain, confirm)` | `team member update`: everything of the member's card but its portrait (`team_brain`: the team's model works it) |
| `member_remove(team, member, confirm)` | `team member remove` |
| `skills_set(team, skills, member, confirm)` | `team skills set`: the team's library skills, or a member's |
| `team_duplicate(team, name, confirm)`, `team_default(team, confirm)` | a copy of the team; the default team (of a project that names none) |
| `team_export(team, file, confirm)`, `team_import(file, confirm)` | the team to a JSON file, or one from it (an id in use gets the next free one) |
| `team_logo(team, image, clear, confirm)` | the team's logo (a .png, .svg or .jpg of 1 MB at most), or none |
| `team_suggest(purpose, skills, lang, limit)`, `team_name_suggest(purpose, lang)` | who of each role fits a purpose and skills, with why; five names for a team |
| `team_runnable(project, team)` | whether the team has a member of each role the project's stations need |
| `team_roster(lang)`, `team_temperaments()` | the employees a member can be; the temperaments a member can have |

### Runs and checks of the software factory

Each is a `nuclear-builder` command in the project; a run starts or goes on in a process of its own (`--detach`) and
stops at each gate for an answer. Every tool that starts, answers or changes asks the user first. A paid provider's
spending is never confirmed here: the run waits (`waiting: spending`) for the user's two confirmations in the editor.

| Tool | What it does |
|---|---|
| `run_start(project, spec, team, assign, specs, confirm)` | the run of a spec (its id), or of several in one run (`specs`: their ids, each through every station before the next, one bill), by the team (empty: the project's); `assign`: who works a role (`developer=dev-017`) |
| `runs(project)`, `run_file(project, id)`, `run_journal(project, id)` | the runs; a run's file (stations, steps, decisions, files, cost, the question it waits on); its journal |
| `run_answer(project, id, answer, text, confirm)` | the user's answer to the question a run waits on: `approve`, `change` (with `text`), `stop`, `yes`, `no` |
| `run_resume(project, id, confirm)`, `run_retry(project, id, station, step, team, confirm)`, `run_restart(project, id, confirm)`, `run_stop(project, id, confirm)` | a run goes on, again from a station or a step (what it wrote from there undone), again from the start, or stopped |
| `checks(project, id)` | a run's checks (QA's plan and the user's) |
| `check_switch(project, id, check, on, confirm)`, `check_add(project, id, title, station, by, prompt, confirm)`, `check_mark(project, id, check, status, confirm)` | a check on or off; a new one; one marked `passed`, `failed` or `skipped` |

### The skills library

Each is a `nuclear-builder skills …` command. A library skill is read-only: clone it to change it.

| Tool | What it does |
|---|---|
| `skills_list(team, member, lang)`, `skills_show(id, team, member, lang)` | the library; with a team or a member, what it gets and where each comes from; one skill's `SKILL.md` |
| `skills_clone(id, team, member, confirm)` | the skill as the team's (or the member's) own, winning over the one it came from |
| `skills_create(team, text, member, confirm)`, `skills_update(id, team, text, member, confirm)`, `skills_delete(id, team, member, confirm)` | an own skill written (`text`: its whole `SKILL.md`, from its front matter), replaced or deleted |

### The line, the CI file, the reports, who can work a member

| Tool | What it does |
|---|---|
| `line_show(project)`, `line_set(project, values, confirm)` | the project's line (`.nuclear/builder.json`) with its defaults; keys set (`{key: value}`), asked first |
| `ci_export(project, host, confirm)` | the CI file of `github`, `gitlab` or `bitbucket` that runs `nuclear-builder ci`; asked first |
| `connections_check(project, team)` | each member's agent or provider of the team answers |
| `metrics(view, project, team, member, since, until, by)` | the factory's reports from its ledger: `bill`, `throughput`, `cycle`, `burndown`, `flow`, `waiting`, `quality`, `people`, `indicators` |
| `agents_list(project)`, `models_list(provider, project)` | the agents and the models that can work a member on this machine |

### The internet

| Tool | What it does |
|---|---|
| `web_search(query, pages)` | searches the internet and answers the first results with the text of their pages (your own SearXNG with `NUCLEAR_SEARXNG_URL`, Brave with `nuclear-graph web-key brave`, else Wikipedia) |
| `web_read(url)` | the text of a public page, without its code blocks. Local addresses are refused |

## 4. What the editor does and this server does not

Each row is a screen of the editor (VS Code, Android Studio) and what of it a model reaches through `nuclear-mcp`.
What it cannot do, the model says so and tells the user where it is done; it never pretends to have done it. The
members of a team in Nuclear Chat also have Nuclear Builder's own server (`nuclear-builder mcp`), which reaches more
of the factory (the last column). **By design** marks what never becomes a tool: a secret, money, the machine.

| Screen of the editor | Through `nuclear-mcp` | Not through it: where | Builder's server (a team's member) |
|---|---|---|---|
| The workspace strip: create, open, rename, describe, add / rename / remove an app | `workspace_*`, `app_*` | open a workspace in the editor, the recent list: the editor | — |
| A project's actions: Run / Serve, Debug, Reload, Device, Build, Test, Check, API | build, test, check (`nuclear_project`), the run's log (`project_run_log`) | start or stop a run, debug, a device, hot reload: the editor's buttons or a terminal | — |
| The file tree: *Make* a part, new file or folder, rename, delete | `generate_*`, `nuclear_project` with `make`; files with the client's own tools | — | — |
| A backend's scripts | — | the explorer's Nuclear Scripts view, Run Task | — |
| HTTP Connections: the endpoints, a request sent, its environments, an OpenAPI added, contracts updated | — | the editor's HTTP Connections, `nuclear contracts update` | — |
| Environments | `nuclear_env` | a secret's value: `nuclear env set NAME --secret` (**by design**) | — |
| Nuclear Monitor | `project_monitor`, `graph_monitor` | — | — |
| Builder, specs: create, list, show, edit, move, migrate, delete, a draft accepted or discarded | `spec_*` | — | the same |
| Builder, runs: start, answer a gate, resume, retry, restart, stop; the run's file and journal; QA's checks | `run_*`, `runs`, `checks`, `check_*` | a paid provider's spending: confirmed twice in the editor (**by design**) | the same |
| The company screen, a team: create, edit (method, instructions, the team's model), delete, duplicate, default, export / import, logo, suggestions, the roster, the temperaments | `team_*` (`team_edit`'s `provider`, `model`: the whole team's) | — | the same |
| A member's profile: role, name, who works it (kind, provider, model, the team's model), instructions, temperament, skills, extra skills, GIF habit, note, its agent | `member_add`, `member_edit`, `member_remove`, `skills_set` | the portrait: the member's card | `team_member_update` |
| The skills library: list, show, clone, create, update, delete | `skills_*` | — | the same |
| The line, the CI file, the checked connections | `line_show`, `line_set`, `ci_export`, `connections_check` | — | the same |
| Reports: the bill and the views | `metrics` | — | the same |
| Which agents and models can work a member | `agents_list`, `models_list` | — | the same |
| Nuclear Chat and Atlas: channels (create, rename, delete, a team assigned), direct messages, reactions, GIFs | — | the chat (`Ctrl+Alt+A`); a model is a member of the chat, not its client | — |
| API keys (the vault) | — | the settings page (**by design**: a key never passes through a model) | `vault_list` (the names only) |
| Settings, the AI set-up, the language, updates | — | the settings page, `nuclear update` (**by design**: the machine's) | — |

## 5. When a tool fails

| The tool answers | What to do |
|---|---|
| the graph refuses the client | `nuclear-graph connect mcp --scopes read,write`, with the graph running |
| `... is not inside a Synapsis project (no config.nuc)` | give the project's folder: `nuclear new <name>` creates one |
| `'<command>' is not allowed here` | the `nuclear_project` tool runs only the commands of its list |
| `'--' is not allowed here` | what follows `--` goes to the target's own tools (a port, a host): an agent never passes it through the MCP server |
| `no run log yet in ...` | the app never ran in that project: run it once (`nuclear run`, or ▷ Run / ▭ Device in the editor), then call `project_run_log` again |
| `{"declined": …}` | the user said no: nothing changed; ask what to do instead |
| `{"preview": …, "confirm": …}` | the client cannot ask: show the preview to the user, then call again with `confirm` only on their yes |
| `the confirm token is unknown, expired or used` / `for another change` | nothing changed: call the tool again without `confirm` for a new preview |
| an error that `workspace` is not a command of `nuclear` | the installed NuclearLang is older than its workspaces: `nuclear update` |
| a generator refuses | its message says what is missing: [when a generator refuses](../../../../nuclear-synapsis-framework/docs/08-guides/generators.md#4-when-a-generator-refuses) |

The graph knows every tool of this page: ask it with `graph_card("mcp:<tool>")`, or ask the editor's chat
(`Ctrl+Alt+A`) in your own words.
