---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [engine.md, ../00-context/domain.md, ../../../../vscode/docs/02-architecture/ai-services.md]
---
# Architecture of Nuclear Builder

```mermaid
flowchart LR
  page[src/panel.ts: the page of VS Code] --> engine[src/engine.ts + src/safety.ts]
  cli[src/cli.ts: nuclear-builder] --> engine
  jb[jetbrains/src/…/NuclearBuilder.java: the JetBrains tool window] -- runs --> cli
  chat[the chat: /task] --> engine
  engine -- HTTP --> dev[Nuclear Developer]
  engine -- "claude -p + the Nuclear MCP" --> claude[Claude]
  engine -- "nuclear gen, the project's commands" --> shell[Shell]
  engine -- writes --> run[".nuclear/builder/runs/<id>.json, .md, .log"]
  page -- draws --> run
  jb -- draws --> run
```

## The parts

| Part | File | What it does |
|---|---|---|
| The engine | `src/engine.ts` | `Spec`, `Run`, `Stage`, `Step`; `BuilderEngine.start()` runs the stages and saves the run on every step (`change` event). No `vscode` import |
| Safety | `src/safety.ts` | atomic writes, the trace log, the heartbeat, the ledger and its rollback, the check of the connections. No `vscode` import |
| The page | `src/panel.ts` | one full-screen webview of the strip (id `builder`, `Ctrl+Alt+P`), like Devices and HTTP: the runs, the spec form, a run as a graph. `driveRun` is module-level; `resumeOrphans` runs on activation |
| The command | `src/cli.ts` | `nuclear-builder`, for a terminal, a CI job and the JetBrains tool window |
| JetBrains | `jetbrains/src/dev/nuclearlang/editor/NuclearBuilder.java` | the *Nuclear Builder* tool window |

## What it calls

- **The Nuclear Developer** over HTTP (`developerUrl`): `/developer/analyze` (the strategy), `/developer/plan`,
  `/developer/test`, `/developer/code`, `/developer/security`, `/developer/document` (the journal's top),
  `/developer/accept` (the acceptance) and `/developer/diagnose` (why a stage failed). Every call carries the
  project's folder, so an agent reads by itself the files its task names.
- **Claude**, when it leads: `claude -p --output-format stream-json` with the Nuclear MCP server
  (`mcpCommand`, default `nuclear-mcp`, started with no argument; `--strict-mcp-config`, `--tools` limited to the stage's built-ins). Every tool call is a
  step; `developer_*` calls are drawn as the local agent.
- **The generators**: `nuclear gen resource ... --from-spec`, `nuclear gen usecase`.
- **The project's commands** of `.nuclear/builder.json`.
- **Jira** (REST v3, ADF to text) and **GitHub** (`gh issue view`), to import a spec.

## What it writes in a project

| File | What |
|---|---|
| `specs/<id>/spec.md` | the spec, written by the specification stage |
| `.nuclear/builder/runs/<id>.json` | the run, saved on every step: the file every editor draws |
| `.nuclear/builder/runs/<id>.md` | the journal |
| `.nuclear/builder/runs/<id>.review.md` | a reviewer's notes |
| `.nuclear/builder/runs/<id>.log` | the trace log (JSON lines) |
| `.nuclear/builder.json` | the commands of each stage (`defaultConfig(platform)`) |
| `.github/workflows/nuclear-builder.yml`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml` | the exported CI (`ciFile()`) |

Configuration, weakest first: the machine's defaults < the editor's `nuclear.ai.*` settings < the project's
`.nuclear/builder.json` (`readConfig(root, platform, machine)`). Jira's site, email and API token are in VS Code's
secret storage (`nuclear.builder.jira`).

## The page (`panel.ts`)

- The runs of the active project on the left.
- The spec form: use case → the spec written or imported → context → who leads, with an optional preview of the plan
  by the local planner.
- A run as a graph: a column per stage, a node per step in the order it ran, the steps its agent followed as nodes
  under it, edges between them. A click on a node opens a drawer beside the graph (*What it did*, its decisions,
  input, output, code) with *Run again from this step*. Each stage has *Run <stage> again*, and the run *Run again
  from scratch* (a modal confirmation: it undoes files).
- The messages of the webview: `retry`, `retryStep`, `retryStage`, `scratch`.

## The command (`cli.ts`)

In `extensions/vscode/`, `npm run builder` → `out/nuclear-builder.js`, also part of `compile`. The project is the closest folder up with
`config.nuc`.

| Command | What it does |
|---|---|
| `nuclear-builder run [spec.md] [--lead local\|claude]` | the whole pipeline (`parseSpecMarkdown`, the inverse of `specMarkdown`); no file = the spec changed last |
| `nuclear-builder retry <run> [--from <stage> \| --step <id>]` | a run again from the step that failed, a whole stage, or any step of it |
| `nuclear-builder restart <run>` | the whole pipeline again from scratch |
| `nuclear-builder ci [stage...]` | the deterministic stages of `.nuclear/builder.json` (`ciCommands`, the same grouping `ciFile` exports) |
| `nuclear-builder export github\|gitlab\|bitbucket` | writes the CI file |
| `nuclear-builder runs` | the runs of this project |
| `nuclear-builder setup [--profile <id>] [--yes] \| --status \| --remove` | the AI services of this machine ([the set-up](../../../../vscode/docs/02-architecture/ai-services.md)) |

## The JetBrains tool window (`NuclearBuilder.java`)

Bottom, `Alt+Shift+P`. Per project (`NuclearConnector.findProjects`): its specs (`specs/*/spec.md`) and its runs
(`.nuclear/builder/runs/*.json`, newest first) → stages → steps (actor, summary, status colors). Below, the selected
step's trace, input, code and output; a step's file opens. Title actions: New Spec (writes the markdown shape
`parseSpecMarkdown` reads), Run the Spec with the local agents or with Claude leading, Server Stages, Export CI,
Stop, Refresh. Each runs `nuclear-builder` in the project and streams its output; the tree reads the run again every
1.5 s and keeps the selection. It has no Retry buttons, and it was never loaded in a running IDE.
