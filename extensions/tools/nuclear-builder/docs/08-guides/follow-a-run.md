---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [write-a-spec.md, pipeline-commands.md, ../00-context/domain.md]
---
# Follow a run

## The graph of a run

The run is drawn as a graph, left to right:

- **A column per stage**: Specification → Generate → Plan → Tests first → Code → Verification → Security →
  Artifacts → Deploy. Each shows its state, its time and the agents that took part; a stage the strategy leaves out
  says why.
- **A node per step**, in the order it ran, and under it the steps its agent followed (recall from the graph, with
  the cards it read by name → write → repair with the compiler).
- **Click a node** and it opens beside the graph: what it did, **the decisions it took and why** (which strategy and
  by which signs, why a piece was dropped or a file went to the tester), its input, its output and its code. The
  step's *For the agent* tab shows what the agent read; *Output* keeps the real log.

## What each stage shows

- **Specification** ends with the **analysis**: which kind of request the spec is and the strategy the run follows.
  The step says what it understood and why; a fact it lacks is asked there, before anything is written.
- **Generate** runs `nuclear gen` for the resources the spec names
  ([write a spec, §4](write-a-spec.md)). A crash undoes the generated files like an agent's.
- **Plan** shows the work as a tree: the big parts (one per component), the tasks of each (a layer: data, domain,
  the facade, the entry points, the tests) and the pieces of each task (one file). It also says, before any code,
  what of the spec is beyond the platform or the local agents: the graph's capabilities whose trigger words the spec
  writes ("authentication" on a backend, "form" on the web), a spec too long for a local model, a plan without
  pieces. Then split the task, give the missing facts, or let a frontier model lead.
- **Tests first** is skipped when the generators wrote every file of the run: they wrote its tests too, and the step
  says which. A resource that reads another API gets no generated test (it would call the real one): the step says
  so, and only the acceptance step holds the criteria against the result.
- **Acceptance.** When the verification passes, each acceptance criterion is held against what the run left. The
  ones the result does not show met are listed as left for the reviewer, in the page and in the journal. It
  informs; it does not fail the run.

## Run anything again

- *Run again from this step*, on every step, passed or failed: it and every step after it run again; the steps
  before it are kept.
- *Run <stage> again*, on every stage.
- *Run again from scratch*, on the run: the whole pipeline from the specification.

What the steps left out wrote is undone first. A file you changed since the run wrote it is kept, and the page says
so. The attempt left behind stays under the run with its reason. A run made by an older version of the Builder starts
from scratch at any retry.

```sh
nuclear-builder retry <run> [--from <stage> | --step <id>]
nuclear-builder restart <run>
```

Over MCP: `developer_retry`.

## The journal

Every run keeps `.nuclear/builder/runs/<id>.md` beside its `.json`: the files written, what is left for the reviewer,
and every step with its agent, its trace and what the agent read. At the end the local **documenter** reads it and
writes, at its top, what was built, how it was checked and what is left. A reviewer's notes go to
`<id>.review.md`.

## When it fails

- A call to the local agents that fails for a passing reason (the service starting, busy, a 5xx) is retried with
  exponential backoff; the settings say how many times and how long. Each retry is in the step's trace.
- When a stage fails, the local diagnoser tells why and what to do. *↻ Retry from <stage>* (or
  `nuclear-builder retry <run>`) runs it again from there, keeping every step that passed.

## It survives the editor, and it keeps working

- A run keeps a trace log, a heartbeat and a ledger of the files it writes. If VS Code closes or crashes in the
  middle, the run is found interrupted when it opens again, what was left half written is undone, and it goes on
  from that step. Two windows never run the same run.
- Every run first checks its connections (the Developer, the graph, Ollama and the models, Claude when it leads,
  free disk). Every few minutes every integration is checked again.
- A run does not stop when you switch tools or close its page. A notification, and a badge on the Nuclear icon,
  tell you when it ends.
- *Settings and integrations* (`Ctrl+Alt+S`) holds the services, the local models, the MCP server for Claude Code,
  Codex and Cursor, the connections and the retries.

## The strategy of a request

A whole system, one screen, a rename and a failing test are not done the same way. The graph holds a **strategy**
for each kind of request (31 rows, `strategy:<name>`; ADR-developer-0001): how the kind is recognised, its plan with the
tool of every step, and what it asks of a run. The local **analyst** picks it before anything is generated or
planned. No model chooses: the request's exact signs decide (a diagnostic code, a test's output, `rename A to B`, a
`GET <url>` line), then its meaning, and whether the project already has the names it writes.

| Family | Kinds of request |
|---|---|
| create | a whole system, a project, a component, a resource of another API, a stored resource, the app of a backend, only an interface, a repository, a use case, a route, one declaration |
| change | one more field, method or action; a rename; a move or an extraction; a break of the architecture's rules; the database's schema; the configuration; taking something out |
| fix | it does not compile; a test fails; it does the wrong thing; it fails while running; the data does not match; a screen shows the wrong thing; the machine or a service fails |
| verify and explain | tests for what exists; a security review; documentation; a question; building, running and shipping |
| beyond | what NuclearLang or the local agents cannot do: said before anything is written |

What a strategy changes in a run:

- **The stages that run.** A compile error skips *Generate*, *Plan* and *Tests first*: the compiler's exact fixes
  first (`nuclear fix .`), then each file with errors is repaired with the card of each error. A failing test goes
  straight to *Verification*. A rename plans and writes, and writes no test.
- **Where the pieces come from.** For a new feature the planner splits what the generators left. For a change of
  something that exists (a field more, a column) the pieces are the files that declare it. For a rename a tool
  gives every file that writes the name, already rewritten: no model writes.
- **What is asked first.** A stored resource without its fields, a rename without its two names, a bug without what
  should happen: the analysis stops the run with the question. Nothing is guessed.
- **The wiring.** After *Code*, each use case the coder wrote is wired by `nuclear gen usecase`: its alias in the
  facade and, when the spec's sentence gives it (`POST orders/{id}/cancel`), its route.
- **A bug's repair** goes to the file the failure names, whoever wrote it, and never to the test.

A request that is not a run (a question, a command, something beyond the platform) stops at the analysis and says
where it belongs. When the analysis read it wrong, name the strategy in the spec (`- Strategy: usecase`, under
`- Use case:`) and run it again.

```sh
nuclear-graph strategy "al cancelar un pedido pagado debería rechazarlo pero lo acepta"   # which strategy, and why
nuclear-graph card strategy:bug-behaviour                                                # its plan
```
