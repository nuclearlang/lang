---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, integrations.md, ../03-adr/0001-a-strategy-for-each-kind-of-request.md, ../05-standards/testing.md]
---
# The strategy of a request, and the analyst

A whole system, one screen, a rename and a failing test are not done the same way. The knowledge base holds a
**strategy** for each kind of request a user makes (31 rows, `strategy:<name>`, on the `playbooks` shelf of the
Smart Graph): how the kind is recognised, its plan step by step with the tool of every step, and what it asks of a
run. Changing how a kind of request is handled is changing a row, never code. Why: `ADR-developer-0001`.

## The kinds of request

| Family | Strategies | In words |
|---|---|---|
| create | `system`, `project`, `component`, `resource-api`, `resource-db`, `client-of-backend`, `interface`, `repository`, `usecase`, `endpoint`, `declaration` | a whole system, a project, a component, a resource of another API, a stored resource, the app of a backend, only an interface, a repository, a use case, a route, one declaration |
| change | `member`, `refactor-rename`, `refactor-move-extract`, `refactor-architecture`, `data-migration`, `configuration`, `remove` | one more field, method or action; a rename; a move or an extraction; a break of the architecture's rules; the database's schema; the configuration; taking something out |
| fix | `bug-compile`, `bug-failing-test`, `bug-behaviour`, `bug-runtime`, `bug-data-contract`, `bug-interface`, `bug-environment` | it does not compile; a test fails; it does the wrong thing; it fails while running; the data does not match; a screen shows the wrong thing; the machine or a service fails |
| verify and explain | `tests`, `security-review`, `document`, `question`, `operate` | tests for what exists; a security review; documentation; a question; building, running and shipping |
| beyond | `beyond` | what NuclearLang or the local agents cannot do: said before anything is written |

## What a strategy row says

Besides its card for people and lead models:

| Field | Meaning |
|---|---|
| `data.signals` | regular expressions over the request: its exact signs (a diagnostic code, a test's output, `rename A to B`, a `GET <url>` line) |
| `meta.triggers` | the words that point to it |
| `data.target` | `existing`: the request names a declaration the project has; `new`: one it has not |
| `asks` | how people ask for it, in English and Spanish: found by meaning |
| `data.mode` | `write`, `repair` (the compiler's errors drive), `fix` (a failing test drives), `review`, `answer`, `commands`, `lead` |
| `data.stages` | the stages of the Loop it runs; empty: this kind of request is not a run |
| `data.pieces` | where its pieces come from: `plan` (the planner splits what is left), `declaring` (the files that declare what the request names), `naming` (every file that writes a name: a rename), `none` |
| `data.generators` | the generators it calls |
| `data.needs` | the facts it cannot start without, each with its question for the user |
| `data.lead` | `frontier` when it needs a model that understands several files at once |

Which strategy a request gets is chosen by the graph, without a model
([the selection](../../../../nuclear-graph-storage/docs/02-architecture/search.md#a-strategy)). A spec may name its
strategy itself (`- Strategy: usecase`).

## The analyst

`components/developer/ai/analyst.nuc`, `POST /developer/analyze`. It runs before anything is generated or planned,
in fixed steps:

1. The project's files say which names of the request exist.
2. The graph gives the strategy (by the request's exact signs, then its meaning, and by which of its names the
   project has).
3. The strategy gives the stages that run, the source of the pieces and the facts it needs.
4. **A model is asked for one thing only**: the resources a request in plain words describes
   (`component | Name | fields | source | actions`). Each line becomes a `dragonfly gen resource` call and is kept
   only if its `--dry-run` accepts it.
5. A fact the request lacks is a question for the user and stops the run: nothing is guessed.

It answers the strategy and why, the stages, the generator calls, the pieces the tools already gave (the files that
declare what changes; every file of a rename, rewritten) and the questions.

A model asked about a request that lists no field invents them. So it is asked only when the request lists some,
and its answer is held to that list: the number of fields must be the request's, it is asked once more when it is
not, and left out (the fields are then asked to the user) when the second answer fails too. Types it reads from
words (`total` as `double`) are shown in the *Generate* step of the run, to be checked there.

## Tools before models

In every strategy:

- A generator writes what is standard. "Suppliers with a name and a phone: add, change and remove them" becomes
  `dragonfly gen resource suppliers Supplier --fields "name:string phone:string" --source db --actions
  create,delete,update`, shown before it runs.
- The compiler's exact fixes (`nuclear fix`) come before any repair.
- A rename is done by a tool and no model writes (`Workspace.renamed`): every file that writes the name as a word,
  with the new one in its place, and with it the project's names built from it (`NewBook` and `BookRepository` for
  `Book`).
- The files a change starts in are found by the project's declarations, not planned.
- A generator finishes what it starts on a resource that exists: `dragonfly gen resource` with a new action adds
  the repository's method and the controller's route too (merged member by member). It refuses a search of a
  stored resource, because which column is searched is a decision (a query of the repository, wired with
  `dragonfly gen usecase --calls`).

A model writes only a piece of one file that no tool can write.

## What a run does with it

The Loop follows the strategy (the project [`extensions/`](../../../../extensions/AGENTS.md) has the pipeline):
the analysis is the last step of the *Specification* stage; the stages the strategy has no use for are skipped;
*Generate* runs the spec's own resources and the calls the analysis derived; *Plan* takes the pieces the tools gave
and asks the planner only when the strategy's pieces come from a plan; *Code* writes a piece a tool already wrote
as it is, and afterwards wires each use case the coder wrote with `dragonfly gen usecase` (its alias and, when the
spec's sentence gives it, its route); *Verification*, for a bug, repairs the file the failure names whoever wrote
it, and never the test. A Developer without an analyst leaves the run as it was: every stage. A lead model gets
the same routing and the same plans over MCP (`graph_strategy`).

## Limits

- `refactor-move-extract`, `remove` and `beyond` need a lead: the local agents do their mechanical steps only.
- A rename by the tool covers a declaration's name and the declarations built from it by a word before or after
  (the platform binds a repository to its entity by its name, so an entity renamed alone compiles and fails when
  it runs). That also takes a declaration that only starts with the name (`OrderLine` with `Order`): the analysis
  lists every name it changes. A field or a method is renamed by hand (the same word may be another declaration's
  member); the file of a renamed declaration keeps its path; a plural (`ListBooks`) and an alias of the facade
  stay. A rename runs no security review: it writes no new logic.
- A bug whose failure names only its test stops at *Verification*: where the cause is needs a lead or the user.
- The Loop writes files and never deletes one.
- Still by hand or by a model, with no generator: relations in a stored resource, the tests of a backend resource
  over another API, what a screen shows of a use case added with `gen usecase` (mobile, web).
