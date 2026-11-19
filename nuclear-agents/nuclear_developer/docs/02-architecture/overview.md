---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [integrations.md, strategies.md, models.md, ../05-standards/testing.md]
---
# Architecture

The Nuclear Developer is itself a Synapsis backend written in Nuclear (platform `backend`, dialect `fastapi`):
FastAPI + LangGraph, generated from the `.nuc` files of this folder. It listens on `127.0.0.1:7879`.

## How an agent works

A small model follows fixed steps better than it chooses tools, so each agent is a LangGraph graph with fixed steps:

```
recall ──► write ──► nuclear check ──ok──► answer
  │          ▲            │
  │          └── repair ◄─┘ errors (at most 3 attempts), each with the card of its code
  └─ from the Smart Graph, for the kind it is about to write: the kind's own card, the mistakes
     small models repeat with that kind, the closest rules, solved tasks and an example file
```

More happens by rule, never by the model's choice:

- **It reads the project by itself.** A request may carry `root` (the project's folder): the coder then gets, as
  its context, the files that declare the names its task writes (`Workspace.context`, read-only, never outside the
  project), besides what the caller pasted. An order can be short: the path, the kind, every name.
- **Its answer is held to the order's own words.** When the answer compiles, the quoted texts, the decorators with
  their arguments, the calls (`books.byAuthor(name)`), the signatures (also the ones without parameters, `all()`)
  and the status codes the task writes must be in it. What is missing is asked for once more, without the examples
  (`agents/faithful.md`), and the first answer is kept when the second is not better. It exists for the short
  orders of a lead, where a renamed call breaks the next piece.
- **The plan says what is beyond the agents.** `POST /developer/plan` answers the pieces, the same plan as a tree
  (`tree`: the big parts, one per component; the tasks of each, a layer; the pieces of each task, a file) and
  `limits`: the rows of the graph's capabilities whose trigger words the spec writes ("authentication" on the
  backend, "form" on the web), a spec longer than a local model reads at once, a plan without pieces or with too
  many. How people write a kind ("application component", "use case") comes from the graph's cards of the kinds.
- **The plan knows the project.** With the project's folder (`root`), a declaration the project already has and the
  spec only uses (`repository: BookRepository`) is not planned again; one the spec introduces with its kind's word
  ("a repository BookRepository with...") is planned as a change of its file; and new pieces go to the component of
  the declarations the spec uses, whatever component the model names.

The whole toolbox of an agent is one row of the graph, `service:agent-toolbox`: the graph, the compiler, the
`nuclear` commands, the project's files and the internet.

## What an agent reads

Not a search over documents: the graph is a library of cards (`ADR-graph-0001`).

| Who | Asks the graph for |
|---|---|
| The coder | `kind:<platform>.<kind>` by its id, the pitfalls whose `kinds` list has that kind, solved tasks and an example file of that kind |
| A repair | `error:<code>` of each code the compiler named |
| The assistant | every shelf with the question, each card with the rows it links to; and the exact facts of a question with one right answer |
| The diagnoser | the cards of the codes in a log and the closest known failures |

**What the agents may read.** Only Nuclear and the platform (`backend`, `mobile`, `web`): a row the agents read
has no target-language code (the build of the knowledge base refuses one that has), a failing test reaches them
told in `.nuc` terms, a piece's errors are given by line, and the diagnoser's prompt forbids speaking of the
generated code. They check with `nuclear check --platform`.

**What it knows** is the knowledge base of the Smart Graph
([`nuclear-graph-storage/data`](../../../../nuclear-graph-storage/data/README.md)); the agents read every row but
the ones about the target languages and the dialects underneath (`agents: false`).

## The agents

| Agent | Model | Route | Does | Does not |
|---|---|---|---|---|
| Coder | `qwen2.5-coder:3b` | `POST /developer/code` | writes ONE `.nuc` file from a precise task, repairs it with the compiler | choose names, data or architecture |
| Tester | `qwen2.5-coder:3b` | `POST /developer/test` | writes the Nuclear tests (`tests` kind) of a piece of code | delete a failing test |
| Security | `gemma4:e2b` | `POST /developer/security` | reviews code against the platform's security rules + the compiler | change the code |
| Documenter | `gemma4:e2b` | `POST /developer/document` | reads a run's journal and writes what was done: what it built, how it checked it, what is left (only facts of the journal) | change the code |
| Assistant | `qwen3.5:2b` (the chat's own model) | `POST /developer/chat` | answers a message of the editor's chat about the project, from the project's map, the session's last messages and the graph; a question with one right answer (which, how many, what are) gets the rows of the graph's exact facts, which end the answer as they are (`ADR-graph-0002`) | change a file (an order is a Builder run) |
| Diagnoser | `gemma4:e2b` | `POST /developer/diagnose` | when a pipeline stage fails: the kind of failure by fixed rules (transient, environment, code, test, spec), the evidence from the tools (`nuclear check`, `nuclear doctor`) and the next step in plain words | change anything |
| Acceptor | `gemma4:e2b` | `POST /developer/accept` | after a run's verification passes: holds each acceptance criterion against what the run left (its files, its tests, the commands that passed) and says which are shown met, with the evidence | fail a run (its verdict is for the reviewer) |
| Planner | `gemma4:e2b` | `POST /developer/plan` | splits a spec into pieces of one file, in order; each path comes from the platform's layout (`nuclear help layout`), each kind and forgotten piece from the spec's own words | choose a folder, or plan what the spec does not name |
| Analyst | `gemma4:e2b`, for one question only | `POST /developer/analyze` | before a run generates or plans anything: which kind of request the spec is, the stages that run, the generator calls, the pieces the tools give, the questions ([strategies.md](strategies.md)) | choose the strategy by a model, or guess a missing fact |

Each request runs on a thread of its own, so nothing of one request reaches the next. The models and their
profiles: [models.md](models.md). The shape of each request and answer: [integrations.md](integrations.md).

## The sources

| Path | What it is |
|---|---|
| `config.nuc` | the project: platform `backend`, dialect `fastapi`, the plugins (`ai`, `ollama`), the dependency on the graph's package |
| `config/project_config.nuc` | the two Ollama connections (the coder's model, the default model) and their context window |
| `components/developer/ai/workbench.nuc` | what every agent shares: the recall from the graph, the project's files, the prompts (the roles' skills, through the graph), the write and repair steps, the order's own words |
| `components/developer/ai/{coder,tester,security,documenter,assistant,diagnoser,acceptor,planner,analyst}.nuc` | one agent each |
| `components/developer/ai/states/piece_state.nuc` | the state of an agent's graph |
| `components/developer/domain/models/developer_models.nuc` | the requests and the answers |
| `components/developer/api/developer_controller.nuc` | the routes |
| `defs/python/nuclear_graph/` | the type definitions of `nuclear_graph.client`, `nuclear_graph.toolchain` and `nuclear_graph.workspace`, generated with `nuclearlang/tools/defs/python/gen.py` |
| `test/` | the project's tests, in Nuclear |
| `eval/` | the evaluation: `run.py`, `tasks.toml`, `results/` |
| `build/` | generated by `nuclear install`; never edited |

**The prompts are files**, never strings in the code: every prompt a model reads is a skill of a role of the
software factory (ADR-developer-0002), `nuclear-agents/roles/<role>/skills/step-<step>.md` with the front matter
`prompt: agent.<step>` (`{{name}}` filled by `Workbench.prompt`, a `## ` section all of whose values are empty
dropped whole; the list is [`roles/README.md`](../../../roles/README.md)), over the use-case guides (the skills with
`prompt: <use case>`). The graph serves them (`ingest` makes its `prompts` collection from the skills), so the
graphs read them as before.

## Known limits

The agents know their own limits: they are rows of the graph (`limit:agent-one-file`, `limit:agent-context`,
`limit:agent-reasoning`, `limit:agent-features`, `limit:agent-nuclear-only`, `limit:agent-internet`) with the
procedure to follow when a task is beyond them (`playbook:escalate`).

- The 3B tester copies a solved example of the graph when it is close to the task (a spec that declares only a
  model got a test of an application component from the examples): the run fails at *Tests first* with the
  diagnosis instead of passing without tests; Claude-led runs fix it.
- The planner maps a kind only from its own word ("application component" is not `appcomponent`) and names a
  component after the first model of a plain spec (`newbooks`).
- A value that comes from a library method has no known type: declare it (`card: string = ~knowledge.card(...)`)
  before using a member of the standard library on it.
- The coder's and the assistant's connections set no limit on the length of an answer (the chat's does: 1024
  tokens): a model that enters an answer without end holds the Developer and every call after it until the process
  is killed. Seen with `qwen2.5-coder:3b` as assistant, `llama3.2:1b` and `phi3:3.8b`; the evaluation has no watch
  on a call that stalls.
- On features of several files written by the local agents alone, a piece renames a method the spec writes, or two
  pieces declare the same thing. That is why a feature goes through the generators first and, when it has a design
  of its own, under a lead.

What is being done about them: [the roadmap](../01-product/roadmap.md).
