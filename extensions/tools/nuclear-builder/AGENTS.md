# Nuclear Builder (`nuclear-builder`)

The pipeline tool of the editors, **Nuclear Builder**, the software factory (spec 011): a spec goes through the
stations analysis, design, tests first, code, quality and delivery on the developer's machine, each worked by a role
of the user's team (a local agent or a provider), and every step shows who did it (the role, the employee, the
provider and model, the shell, you). It is a tool of the Nuclear workspace in VS Code
(`Ctrl+Alt+P`), a tool window in Android Studio / IntelliJ (`Alt+Shift+P`) and the `nuclear-builder` command in a
terminal or a CI job. It needs the Smart Graph and Nuclear Chat running. The local models (the Nuclear Developer,
Ollama's set-up, the profiles lite, medium and hard) are on standby (ADR-platform-0013): the switch
`"localModels": false` of `setup.json` (`localModels()`), read everywhere one is run or offered; their code stays,
dormant, and turning it on again needs its own tests. The `local` kind is OpenCode on Ollama's models
(`opencode-local`, providers.md).

## Where the code is
All of it is in this folder, in two parts while spec 011 (the software factory) moves the engine to Nuclear:
- **Nuclear** (`python` dialect, `nuclear.toml`): the set-up of the AI services, the `nuclear-builder` command, and
  the software factory's teams, vault and providers.
  `nuclear build .` writes `build/nuclear_builder`, packaged by `pyproject.toml` and installed in the AI archive
  (`installer/release/ai-runtime.sh`). Its line's commands (`run`, `retry`, `restart`, `runs`, `checks`, `ci`,
  `export`) run the software factory's engine, in Nuclear.
- **TypeScript**: the VS Code page, which runs the line as a process and draws its run file, compiled and bundled by
  the VS Code extension (`src/`, `test/`, `extensions/vscode/tsconfig.json`); the JetBrains `build.sh` compiles
  `jetbrains/src/` with the plugin.

| File | What it is |
|---|---|
| `setup.nuc` | the set-up: the switch `localModels()` and the profiles offered (`offeredProfiles`, `onStandby`), this machine, the profiles and how each sits on it, the ports, the services at login, the steps (`standby` first on a machine that still has something local, `retireLocal`: the Developer's service and launcher, the models it pulled, Ollama when it installed it, the GB freed; the commands they run say each line as it comes, a Python one too: `PYTHONUNBUFFERED`); no editor |
| `cli.nuc`, `terminal.nuc` | the `nuclear-builder` command: `setup` in a terminal and for the editors (`--plan --json`, `--events`, `--status --json`, `--restart`, `--set`), `team …` and `vault …` (JSON for the editors; `team screen`: the company screen in one call), `spec …` (with `update`, and `accept`/`discard` of a draft), `member`, `chat-host`, `agents`, the line's commands of `line.nuc`; `member`, `chat-host` and `mcp` import their modules when they run (`lazy_imports` of `nuclear.toml` puts each import in its command's branch: the `mcp` library is 300 ms), so every other command starts in under 100 ms |
| `line.nuc` | `run`, `retry`, `restart`, `runs`, `checks`, `ci`, `export`, `line`: the factory in a terminal, a CI job, an editor's process (`--events`: JSON lines out, answers in) or apart (`--detach`); `run answer|stop|show|journal` |
| `factory.nuc` | the software factory's engine: the stations, the roles' steps, the strategy, the wiring, the repairs, the lead, the acceptance, the diagnosis, the gates, the checks, the money, the delivery |
| `run.nuc` | the run file and its journal (`<id>.md`), the spec, the trace log, the owner's heartbeat, the ledger, the rollback, the recovery |
| `specs.nuc`, `spec_line.nuc` | the specs by component and layer (`specs/<component>/[<layer>/]<id>/`, `_global`): their folders, a run's `specPath`; `spec new`, `list`, `move`, `migrate`, a draft's `accept` and `discard` |
| `chat.nuc` | the factory's agent in a conversation, the base of `member.nuc`: its turn, its factory tools (the Builder's MCP tools; text blocks for the local member), what a tool asks of the user asked and applied, the role files' guard, its spending |
| `usage.nuc`, `metrics.nuc` | the reports (spec 017): the factory's ledger (`~/.config/nuclearlang/factory/ledger/<yyyy-mm>.jsonl`, one line per step, run and chat answer across projects; the lines of a write; the runs of before copied once) and `metrics … --json` (the tool `metrics`): the bill, throughput, cycle, burndown, flow, waiting, quality, people, indicators |
| `tools.nuc`, `mcp.nuc` | every action of the Builder as an agent's tool (`BuilderTools`, `applyForUser`, `projectRead`: a PDF, a `.pptx`, text) and `nuclear-builder mcp`, the Builder's MCP server (docs/02-architecture/actions.md; `--informs`: only `INFORM_TOOLS`, Nuclear Atlas's) |
| `member.nuc` | Nuclear Chat's host (spec 013): `member --team --member <id> --events` (`--role`: the role's first member), a member's one answer (the chat's turn with the member's own prompt), and `chat-host --json`, every member of every team (`<team>-<member id>`; only each team's tech lead and `atlas` `listed`), the channels and the general agent `atlas` with its choices; Atlas only informs (`ATLAS_ROLE`, its tools `--informs`), the tech lead plans, explains and assigns (spec 023) |
| `memory.nuc` | every channel's memory (spec 023 requirement 8): `.nuclear/builder/chat/memory/<channel>[/<thread>].jsonl`, written without a model call (`rememberAsked`: the request and the others' messages; `ChannelMemory`: specs, runs, plans, open questions from the member's events), the prompt's *What this channel remembers* (`memorySection`: newest first, capped), and `chat memory <channel> [--thread] [--clear] --json` |
| `chat_agents.nuc` | `agents --json` (the tool `agents_list`): the agents a conversation can choose on this machine (no local one while the local models are on standby), the general agent's choices for the chat (spec 013 requirement 17), the default external choice (`externalWorker`: the first agent installed, Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Grok Build; else the first API provider with a key and a priced model; else none, `NO_PROVIDER`) |
| `models.nuc` | `models --json` (the tool `models_list`): each provider's models from the provider (Claude Code's, `opencode models`, an API's list, Ollama's installed and pullable ones, none while the local models are on standby), this machine's memory, a local model's memory need and fit (fits, tight, too-big), the members' memory `warnings` of `team create`/`member add|update` (spec 011 req. 35) |
| `checks.nuc`, `preflight.nuc`, `ci.nuc` | the run's checks (`checks.json` in the spec's folder); *Check the connections*; the line (`.nuclear/builder.json`), its CI commands and files |
| `setup.json` | the data of the set-up: the switch `localModels` (false: ADR-platform-0013), the requirements, the embeddings model, the profiles (lite, medium and hard kept, not offered) |
| `roles.nuc` | the software factory's five roles, its stations, where the roles' folders are, their rosters (with each employee's face and its thumbnail), the temperaments |
| `teams.nuc` | the teams (`~/.config/nuclearlang/factory/teams/<id>.json`, ADR-platform-0010): the members (any number per role, each its id, employee, who works it, settings, personality), an old file (`roles`) converted on its first read, validation, atomic write and `.bak`, who works a role (`memberFor`), the roles a team lacks (`team runnable`), `team create` and `team member add|remove|update`, who works a member by default (`defaultWorker`: the local one while the local models are on, else `externalWorker`; `newMember`, `localTeam`), a local member converted on read while they are on standby (`healTeam`: the default external choice, a `warnings` line each, the file of before as `.bak`), the run's team, the tech lead (a member), purpose, skills, description, logo (`team logo`); the method (Scrum by default) and instructions every member follows (`teamWay`), the team's brain for every member without its own (`withBrains`, `inheritsBrain`), the spending asked only of an API (`asksSpending`, spec 023) |
| `library.nuc`, `skills.nuc` | the library of skills and agents (`nuclear-agents/skills`, `nuclear-agents/agents`, spec 011 req. 34): read, an old team's skill words as ids, a team's and a member's own skills (`ownSkills`), what a member gets (`sharedSkills`, `withSkills`: the member's own over the team's, the team's over the library's, a base agent's text); `skills list|show|clone|create|update|delete` and `team skills set` |
| `suggest.nuc` | the new-team wizard's suggestions, deterministic: the roster's employees for a purpose and skills, with why (`team suggest`), and satirical names from `nuclear-agents/roles/team-names.json` (`team name-suggest`) |
| `vault.nuc` | the API keys in the system's keyring (service `nuclear-factory`) |
| `adapter.nuc` | the providers' interface (`Role`, `Work`, `Outcome` with its `usage`, `runAdapter`), the role composed from its folder, the documents, the files changed, a command's lines, the retries |
| `adapter_local.nuc`, `adapter_claude_code.nuc`, `adapter_opencode.nuc`, `adapter_codex.nuc`, `adapter_gemini_cli.nuc`, `adapter_cursor.nuc`, `adapter_grok.nuc` | the `local` and `agent` adapters, one per provider |
| `adapter_api.nuc`, `api_anthropic.nuc`, `api_openai.nuc`, `api_google.nuc`, `api_openrouter.nuc` | the factory's loop for the `api` providers (the MCP server as a client, the prices, the budget) and each one's wire format |
| `tests/*.nuc` | the tests (pytest): the set-up, the teams, the vault, the adapters, the agents (their commands stubbed), the APIs (HTTP stubbed), the factory (the Developer stubbed), the specs, the chat and the members (their providers stubbed), a channel's memory and a team's channel as its tech lead (`test_memory.nuc`), the reports (`test_metrics.nuc`: the usage of each agent, the ledger, a fixture ledger's views), with `tests/support.nuc`; `test_compat.nuc` loads the files of earlier versions kept in `tests/fixtures/compat/` (teams, runs, flat specs, the line, an older chat, a team of the local models of 0.82 converted while they are on standby; the release's backward-compatibility battery); `localOn(monkeypatch)` of `support.nuc` switches the local models on for the tests of their dormant code |
| `src/runs.ts` | a run for the editors: the run file's types, the spec's markdown, `LineRun` (one run's process: `nuclear-builder … --events`), `lineJson`; no `vscode` import |
| `src/support.ts` | what the editors keep in TypeScript: the tools' `PATH`, the retry policy, *Check the connections*, Jira and GitHub, the context suggested; no `vscode` import |
| `src/panel.ts` | the page of VS Code, the workbench (spec 011 req. 19-25): the diagram (or the spec form; no chat of its own: a member, the team or *Ask* open Nuclear Atlas on that conversation, `nuclear.atlas.open`), the node as a debugger's tree over the run's log and the team's logo on the right, foldable and resizable; *who* as one label; the specs and runs for the Workspace's column (`builderSidebar`, `sidebarChanged`, `BuilderPanel.drive`); the runs' processes (`driveRun`); Nuclear Chat's host: a run told as a thread (`followRun`), its buttons, a spec's thread, `/poc` (`docs/02-architecture/chat.md`) |
| `src/workbench.ts` | what the pages compute, the same in the tests: the specs' tree, a run's accordion, the run's log, *who* (`whoLabel`), a step's inner process (`stepTree`), a team's work (`teamWork`), a logo's initials and colour; inlined in the pages' scripts; no import |
| `src/flow.tsx`, `src/flow.css`, `src/story.ts` | the run's work diagram (React Flow) in C4's four levels: context (the run told to a product owner: five business steps, `storyOf`), stations, inside a station, inside a step (the tool calls only with *Technical details*); no `vscode` import; `tsconfig.flow.json` checks it |
| `src/teams/` | the company screen (VS Code): `page.ts` the page, a cyberpunk HUD (the teams as framed panels; the new-team wizard's five steps; a team's members grouped by role, the member panel: a compact header with its Brain (every model of each external provider: no local kind, ADR-platform-0013; the command's conversion `warnings` drawn as a line), then Overview, the settings' tabs and the fun Profile; the hiring pool only while adding, a role's *+ Add* to *Done*; *Talk* and *Channel* open Nuclear Atlas through `team:chat`: a member who does not lead opens the tech lead's conversation, `chatChannel`; *How the team works*: the model for the whole team, the method and the instructions, `team:update` → `team update`, spec 023), `wizard.ts` what the wizard computes, `skills.ts` what the skills' screens compute (a skill's markdown as safe HTML, the editor's SKILL.md and back, the library by kind, a member's skills with where each comes from), `hud.ts` what it computes (a stat's level, the budget gauge, the pool's filter, a team's spending, a member's activity), `l10n.ts` its texts, `host.ts` its host (shared with the welcome), `panel.ts` its panel (`nuclear.builder.teams`, `{ wizard: true }` straight to the new-team wizard), `cli.ts` the `nuclear-builder team|vault|agents|models --json` calls and the logo read as a `data:` URL; no team file is written by the editor |
| `src/reports/` | the *Reports* page (VS Code, spec 017): `panel.ts` its panel (`nuclear.builder.reports`), `host.ts` its messages (`metrics --json`), `page.ts` the HUD page, `charts.ts` the numbers and the inline SVG charts, `l10n.ts` its texts, `metrics.ts` the command's call (also the member panel's Summary numbers) |
| `src/actions.ts` | the command each message of the pages calls (ADR-platform-0009; a test holds it to actions.md) |
| `src/settings.ts`, `src/l10n.ts` | the Builder's settings (`nuclear.builder.*`); the Builder page's texts |
| `test/compat.test.ts` | the editors' backward compatibility (`npm run test:compat`): the earlier engines' run files on the page, the moved settings, the saved projects of before 0.63.0 |
| `test/editors.test.ts`, `test/vscode-stub.ts` | the editors' tests (node:test, `vscode` stubbed): the money, the moved settings, the teams' calls, a run's process against a stub command, the workbench (the specs' tree, the runs' accordion, the log, *who*, a step's tree, a team's work and logo, the specs' layout), the retries, the tools' `PATH`, the connections (the Smart Graph, no local service), Nuclear Atlas's templates, no local kind in the pickers (ADR-platform-0013), the Spanish texts |
| `jetbrains/src/dev/nuclearlang/editor/NuclearBuilder.java` | the *Nuclear Builder* tool window: a run as `nuclear-builder … --events`, its questions as dialogs |

## Stack
- Nuclear, `python` dialect (Python 3.12+, httpx, the `mcp` library as `tools/mcp` uses it) for the set-up, the
  command and its MCP server
- TypeScript, bundled with esbuild into the VS Code extension: the page is plain HTML and script, its diagram React
  19 with React Flow 12 (`@xyflow/react`), bundled apart for the browser
- The agents: the Nuclear Developer over HTTP, and any provider of `docs/02-architecture/providers.md` (an agent's
  command line with the Nuclear MCP server, or an API)
- Java (Swing) for the JetBrains tool window

## Commands
Run here:
```sh
nuclear check . --json && nuclear build .     # the set-up and the command, into build/nuclear_builder
cd build && pytest nuclear_builder/tests && pyright nuclear_builder   # its tests and types (httpx, pytest installed)
nuclear fmt --check .                         # the spacing of the .nuc files
```
Run in `extensions/vscode/`:
```sh
npm test            # ../tools/nuclear-builder/test/editors.test.ts (node:test, vscode stubbed)
npm run test:compat # test/compat.test.ts; the whole battery: extensions/scripts/compat-check.sh (release runbook)
npm run flow        # out/builder-flow.js and .css (the run's diagram)
npm run compile     # the types (flow.tsx too), the diagram, the extension (with src/panel.ts)
```
The tool window: in `extensions/jetbrains/`, `IDE_HOME=/opt/android-studio ./build.sh`.
`installer/install.sh` builds this project and installs it editable with uv as `~/.local/bin/nuclear-builder`; a
release brings it in the AI archive (`ai/bin/nuclear-builder`).

## Rules
- The editors run the set-up as a process (`nuclear-builder setup ...`), one call per action: no process of it stays
  alive (decided by the user: the least memory and the fewest problems of compatibility). Its JSON is the contract
  of the pages.
- The chat is Nuclear Chat (`docs/02-architecture/chat.md`): the service runs a member's `nuclear-builder member
  --events` per answer; a member writes only through the factory's tools, never a role's files, and a spec only when
  the user accepts its draft. The extension holds the service's token; a page never does.
- The editors run the line as a process, one per run (`nuclear-builder run|retry|restart … --events`, the contract of
  `docs/02-architecture/engine.md`); `runs.ts` and `support.ts` never import `vscode`.
- **The UI is only a UI** (ADR-platform-0009): every action is a command of `nuclear-builder` and a tool of
  `nuclear-builder mcp` ([actions.md](docs/02-architecture/actions.md)); a new button costs its command, its tool, its
  row there and its test first. A tool never confirms money (`waiting: spending`) nor destroys or acts in the user's
  name (`needsUser`); merging is never a tool.
- The page only draws and answers. A run belongs to the extension (`driveRun`'s processes, module-level): closing the
  page or switching tools leaves it running.
- A run is `.nuclear/builder/runs/<id>.json`, saved on every step: every editor and the command draw that same file.
- The factory's adapters render a role in a temporary folder of the run, never in the user's files; no agent gets
  a shell; an API key lives only in the keyring and never reaches a log, a run file or an error.
- Commands are data (`.nuclear/builder.json`): the shell runs nothing that is not there.
- The local agents only ever see Nuclear and the platform, never a dialect's language.
- No Nuclear Builder for Zed (decided by the user).
- The decision behind the pipeline is ADR-platform-0003, the software factory ADR-platform-0005 (its teams amended by ADR-platform-0010), the workbench and
  the chat ADR-platform-0006; the strategies, ADR-developer-0001; the generators, ADR-codegen-0001.

## Documents (read by task)
| You need… | Read |
|---|---|
| What the tool is for, who leads and why | [docs/00-context/vision.md](docs/00-context/vision.md) |
| The words: spec, run, stage, step, actor, journal, ledger, strategy | [docs/00-context/domain.md](docs/00-context/domain.md) |
| The files, the agents it calls, what it writes in a project, the JetBrains window, the command | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| How the engine runs, retries, undoes and survives a crash; the specs by component and layer | [docs/02-architecture/engine.md](docs/02-architecture/engine.md) |
| The Builder in Nuclear Chat: the host file, the members, a run as a thread, a spec's draft, `/poc` | [docs/02-architecture/chat.md](docs/02-architecture/chat.md) |
| The usage of every call, the factory's ledger, `metrics` and the Reports page | [docs/02-architecture/reports.md](docs/02-architecture/reports.md) |
| To read the reports (VS Code, a terminal, an agent) | [docs/08-guides/read-the-reports.md](docs/08-guides/read-the-reports.md) |
| Every action of the pages: its command, its MCP tool, who may do it | [docs/02-architecture/actions.md](docs/02-architecture/actions.md) |
| The teams, their commands and JSON, the roster, the vault | [docs/02-architecture/teams-and-vault.md](docs/02-architecture/teams-and-vault.md) |
| The providers: the adapters' interface, each provider's command line or API, the costs | [docs/02-architecture/providers.md](docs/02-architecture/providers.md) |
| The index of the user's guides | [docs/08-guides/README.md](docs/08-guides/README.md) |
| To write a spec (VS Code, JetBrains, a terminal) | [docs/08-guides/write-a-spec.md](docs/08-guides/write-a-spec.md) |
| To follow a run, run something again, read a failure | [docs/08-guides/follow-a-run.md](docs/08-guides/follow-a-run.md) |
| The commands of each stage, the CI export | [docs/08-guides/pipeline-commands.md](docs/08-guides/pipeline-commands.md) |
| To make a team (the wizard), its members and who works them | [docs/08-guides/make-a-team.md](docs/08-guides/make-a-team.md) |
| To have the team read slides, write the specs and run them from the chat | [docs/08-guides/ask-the-team.md](docs/08-guides/ask-the-team.md) |
| The pending work of the tool | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The settings page, the set-up, the notifications | [the VS Code extension](../../vscode/docs/02-architecture/ai-services.md) |
| The agents, the graph, the MCP server | `nuclear-agents/nuclear_developer/`, `nuclear-graph-storage/`, `tools/mcp/` |
