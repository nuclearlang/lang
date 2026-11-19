---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, strategies.md, ../06-runbooks/run.md]
---
# Integrations and contracts

## The HTTP API

On `127.0.0.1:7879`. Every route is `POST /developer/<name>` and answers `200`.

| Route | Request | Answer |
|---|---|---|
| `code`, `test`, `security` | `{task, platform = "backend", path, kind, context, root}` | `{code, report, check, attempts, trace: [{step, detail}]}` |
| `document` | the same; the run's journal in `context` | the same; the summary in `report` |
| `diagnose` | the same; `task` is the step, `context` its output, `path` the project's folder | the same |
| `accept` | the same; `task` the criteria, numbered; `context` the facts and the files of the run | the same |
| `chat` | `{message, platform, map, history, root}` | the same answer (`report`) |
| `plan` | `{spec, platform, root}` | `{pieces: [{path, kind, task}], raw, trace, tree, limits}` |
| `analyze` | `{spec, platform, root, strategy}` | `{strategy, title, why, mode, stages, lead, source, generate, pieces, questions, limits, report, trace}` |

- `platform` is `backend`, `mobile` or `web`: the agents name a platform, never a dialect. Any other value (`""`,
  a dialect's name) is refused with 400 (the validation error, naming the field) before an agent runs (it was a 500 from the graph's `/v1/kinds/`).
- `root` is the project's folder: with it an agent reads the project by itself.
- `trace` is the steps the agent followed, with what it read.
- The analysis runs before a run generates or plans anything: [strategies.md](strategies.md).

## Where it works

| Who calls it | How | What the Developer does |
|---|---|---|
| The **Builder** (VS Code `Ctrl+Alt+P`, Android Studio *Nuclear Builder*, `nuclear-builder run`) | spec → plan → tests first → code → verification → security → artifacts → deploy | the planner splits the spec, the tester writes the tests first (and fixes a test file the project rejects), the coder writes each piece and repairs it with the compiler and with failing tests told in Nuclear (`nuclear explain`), the security reviewer reads each new file; when a stage fails the **diagnoser** says why; at the end the **documenter** writes the journal's summary |
| **Nuclear Atlas** (VS Code `Ctrl+Alt+A`) | a question, or `/task <order>` | the **assistant** answers from the project's map and the graph; an order is a Builder run with the local agents only |
| A **frontier model** over MCP (Claude Code, Codex, Cursor: `nuclear-mcp`) | `developer_task` first, then validate, correct, `developer_review`; `developer_retry` after a failure | the whole task by the local agents (`nuclear-builder run --lead local`), documented in the run's journal; the lead's corrected files become graph examples |

The Builder, Nuclear Atlas and `nuclear-builder` are the project [`extensions/`](../../../../extensions/AGENTS.md); the MCP
tools (`developer_task`, `developer_retry`, `developer_review`, `developer_code`, `developer_test`,
`developer_security`) are the project [`tools/mcp`](../../../../tools/mcp/AGENTS.md).

**Every run is documented.** `.nuclear/builder/runs/<id>.md` (beside the `.json` with every log whole): the
documenter's summary (what it built, how it checked it, what is left), why it failed (the diagnoser), the files
written, what is left for the reviewer, and each step with its agent, its trace and what it read; a frontier
model's review is `<id>.review.md`.

**When something fails.** A call to the Developer that fails for a passing reason (down, busy, 408/425/429/5xx) is
retried by its caller with exponential backoff and full jitter (5 tries, 1–30 s by default; `Retry-After` wins). A
compiler error or a failing test is never retried blindly: it goes to the repair rounds, then to the diagnoser
(kind by rules: transient, environment, code, test, spec; evidence from `nuclear check` or `nuclear doctor`; the
next step). A failed run goes on from the step that failed (*↻ Retry*, `nuclear-builder retry <run>`,
`developer_retry`): every step that passed is kept, the earlier attempt stays in the run file.

**When the editor closes in the middle.** A run keeps a trace log (`.nuclear/builder/runs/<id>.log`), a heartbeat and
a ledger of the files it writes; an orphaned run is recovered (its unfinished step's files undone) and goes on from
that step. A call to the Developer nothing works on (the Developer silent, Ollama holding no model) is cut and
retried, and every run first checks that the Developer, the graph, Ollama and the models it needs answer.

## What the Developer consumes

| Service | Use | Setting |
|---|---|---|
| The [Smart Graph](../../../../nuclear-graph-storage/AGENTS.md) (`127.0.0.1:7878`) | every recall, the strategy of a request, the exact facts, the prompts (the roles' skills); the client `nuclear-developer` with the scopes `read,write` | `NUCLEAR_GRAPH_URL`, `nuclear-graph connect nuclear-developer --scopes read,write` |
| Ollama | the two models | `OLLAMA_URL`, `CODER_MODEL`, `ASSISTANT_MODEL`, `CONTEXT_TOKENS` |
| The `nuclear` command | `nuclear check --platform` of every answer, `nuclear help layout`, `nuclear gen ... --dry-run`, `nuclear explain`, `nuclear doctor` | on the `PATH` |
| The graph's package (`nuclear_graph.client`, `.toolchain`, `.workspace`) | the client, the compiler for an agent, a project's files | a dependency of `config.nuc`, typed by `defs/` |
