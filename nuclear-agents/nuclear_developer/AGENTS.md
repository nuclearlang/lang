# Nuclear Developer

The local agents of NuclearLang and Synapsis (coder, tester, security reviewer, planner, analyst, documenter,
diagnoser, acceptor, assistant) on models of at most 3B parameters, as the junior developer of a frontier model.
What a small model cannot hold comes from the Nuclear Smart Graph (a library of cards); what it writes is checked
by the Nuclear compiler before it answers. ADR key: `developer`.

The platform's rules are the root [`AGENTS.md`](../../AGENTS.md); the agents' index is
[`../AGENTS.md`](../AGENTS.md).

## Stack

- **Source:** Nuclear, a Synapsis backend (platform `backend`, dialect `fastapi`; `config.nuc`). `build/` is the
  generated FastAPI + LangGraph application.
- **Models:** two, on Ollama: `qwen2.5-coder:3b` (the coder) and `gemma4:e2b` (the default); `CODER_MODEL`,
  `ASSISTANT_MODEL`, `OLLAMA_URL`, `CONTEXT_TOKENS`. The chat answers with one small model of its own
  (`CHAT_MODEL`, `qwen3.5:2b`; `CHAT_CONTEXT_TOKENS` 4096, `CHAT_KEEP_ALIVE` 3m, no thinking, 1024 tokens at most).
- **Knowledge:** the [Smart Graph](../../nuclear-graph-storage/AGENTS.md) on `127.0.0.1:7878`, through its client
  package (`nuclear_graph`, typed by `defs/`). The prompts are the skills of the roles
  ([`../roles/`](../roles/README.md), `skills/step-<step>.md`), served by the graph.
- **Server:** `127.0.0.1:7879`, `POST /developer/<agent>`.
- **Evaluation:** `eval/run.py` (Python), over `eval/tasks.toml`.

## Commands

In this folder:

| | |
|---|---|
| Check and build | `nuclear check . && nuclear build .` |
| Build with its environment | `nuclear install` |
| Run by hand | `cd build && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 7879` |
| Run as installed | `nuclear-builder setup` (once), then the `nuclear-developer` service; `nuclear-builder setup --status` |
| Tests | `nuclear test` (needs the graph running: `nuclear-graph serve`) |
| Types of the generated code | `cd build && ../../../nuclearlang/tools/python/.venv/bin/pyright --pythonpath .venv/bin/python app` (0 errors, strict) |
| The evaluation | `cd eval && ../../../nuclear-graph-storage/.venv/bin/python run.py local` (also `reference`, `distill`, `analyze`, `chat`, `report`) |

## Folders

- `config.nuc`, `config/project_config.nuc`: the project and the two model connections.
- `components/developer/ai/`: `workbench.nuc` (what every agent shares) and one file per agent;
  `states/piece_state.nuc`.
- `components/developer/domain/models/`, `components/developer/api/developer_controller.nuc`: the requests and
  answers; the routes.
- `defs/`: the type definitions of the graph's package.
- `test/`: the project's tests, in Nuclear (`roles_test.nuc`: the roles' folders). `eval/`: the evaluation
  (`run.py`, `tasks.toml`, `results/`).
- `build/`, `.nuclear/`: generated. `docs/`: the context documents (the table below).

<!-- nuclearlang -->
## NuclearLang

This project is written in NuclearLang (`.nuc`), dialect `fastapi`. Its syntax is not TypeScript, Dart nor Python.

- Before writing code, read the sheet: `nuclear spec --brief --dialect fastapi`.
- After each change: `nuclear check . --json` must report no errors; fix exactly what each error says (most carry a `fix`).
- Look up instead of guessing: an API `nuclear defs show <Name> --dialect fastapi`; a kind or decorator
  `nuclear help <word> --dialect fastapi` (all: `nuclear help words --dialect fastapi`); a topic `nuclear help <topic>`.
- Never edit generated code (`build/` and the `.ts`/`.dart`/`.py` built from the `.nuc`): change the `.nuc` files.
<!-- /nuclearlang -->

## Rules

- **A change to an agent or to a prompt of the graph is measured**: run `eval/run.py local` and keep the report
  (a new row of `docs/05-standards/evaluation-rounds.md`).
- **The models stay at 3B parameters or less** (the user's rule).
- **What an agent knows is a row of the knowledge base** (`nuclear-graph-storage/data/assets/`), never a text
  inside the code or a prompt: a new rule, pitfall, limit or procedure is a row there
  (`nuclear-graph knowledge build`, `check`, `ingest`).
- **The prompts are files**: the skills of the roles (`nuclear-agents/roles/<role>/skills/`, ADR-developer-0002),
  never strings in the code. `test/roles_test.nuc` keeps every role folder complete.
- **The agents write only Nuclear**: they name a platform (`backend`, `mobile`, `web`), never a dialect, and read
  only the graph's rows for agents.
- **A failure of the evaluation is fixed with a general rule or more knowledge**, never with the answer of its
  task; the held-out tasks never reach the graph.
- **Tools before models**: what a generator, the compiler's fixes or a rename tool can write, no model writes.
  No agent writes target code for a feature or translates native code into Nuclear by hand
  ([ADR-platform-0004](../../docs/03-adr/0004-products-are-made-with-the-tools.md)).
- A change to a route or to a request updates `docs/02-architecture/integrations.md`. A structural decision is a
  new ADR in `docs/03-adr/`. What cannot be read from the code or the documents is asked, not invented.

## Documents (open the one the task needs)

| Read when you… | Document |
|---|---|
| need what the Developer is for and what it does not do | [docs/00-context/vision.md](docs/00-context/vision.md) |
| look for what is pending, half done, untested or to decide | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| change an agent, its steps, what it reads, the sources; or hit a limit of the agents | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| change a route or a request, or need who calls the Developer and what happens when a call fails | [docs/02-architecture/integrations.md](docs/02-architecture/integrations.md) |
| add a kind of request, change the analyst, or need what a strategy row says | [docs/02-architecture/strategies.md](docs/02-architecture/strategies.md) |
| choose a model or a profile, or need how another model measured | [docs/02-architecture/models.md](docs/02-architecture/models.md) |
| ask why something was decided | [docs/03-adr/README.md](docs/03-adr/README.md) |
| work on the LoRA of the coder | [docs/04-specs/README.md](docs/04-specs/README.md) |
| test a change, or need how the agents are evaluated and where they stand; change a role's files (`../roles/`) | [docs/05-standards/testing.md](docs/05-standards/testing.md) |
| need what a past round changed and measured, or record a new one | [docs/05-standards/evaluation-rounds.md](docs/05-standards/evaluation-rounds.md) |
| install, start or configure the Developer, or see it fail | [docs/06-runbooks/run.md](docs/06-runbooks/run.md) |
| need what a user reads: what a task goes through, how to call it, what it needs, its limits | [docs/08-guides/README.md](docs/08-guides/README.md) |
| run the evaluation or measure another model | [docs/06-runbooks/evaluation.md](docs/06-runbooks/evaluation.md) |
