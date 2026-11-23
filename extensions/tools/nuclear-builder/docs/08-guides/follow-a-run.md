---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [write-a-spec.md, pipeline-commands.md, ../00-context/domain.md]
---
# Follow a run

## Where things are

While the Builder is the open tool, the Nuclear Workspace's column (beside the strip) holds *+ New spec*, your specs
by component and layer, and the runs as an accordion: open several at once (a running one opens by itself), each with
its stations and, for the one working, waiting or failed, its steps live. A click there opens it on the page: a spec,
a run, or a station or step picked in the diagram and the node.

A run opens as **its progress**: the six stations in a line (done ✓, working now, ❗ waiting for you, ✕ failed, next),
each with who works it; what is being done now in one sentence (or what waits for your answer, with *Answer*); and
**the spec it works on**, its description and acceptance criteria. *Technical diagram* in the run's header shows the
diagram below instead. A run the team starts from the chat appears by itself: the open Builder moves to it, a notice
says so, and opening the Builder shows the run being worked on.

On the page, the diagram; on the right, above, **the node**; below, **the log**, with the logo of the team doing the
work. The right column folds (`»`) and resizes (drag its edge); the page remembers it. The page has no chat: click
the team at the foot of the log, or a member of the team in the spec form, and Nuclear Atlas opens on its channel or
on your direct message with that member.

In Nuclear Atlas, each run is a thread of its team's channel: the tech lead starts it, each member says when their
station passed or failed (a failure may come with the member's GIF), and a gate or QA's plan is the member's
question with buttons: **Approve**, **Ask for a change** (the editor asks what), **Later**, **Go on**. A click answers
the run as the page does. Money is never answered in the chat: the editor asks its two questions.

Everywhere, *who* is one label: the member, the role, the provider and the model (*Neo · Developer · Claude Code ·
haiku*; a local one *… · Nuclear Developer · qwen2.5-coder:3b*). The Smart Graph and the shell appear only where
they took part.

## What a station asks you

At the top of the right column, a station that needs you says so (and the run's head shows *It waits for you*) (the run waits; the page, a notification and the badge on the
Nuclear icon tell you):

- **A gate** (after Analysis and Design, and before Delivery, by default; the line's `"gates"`): *Approve the Design
  of <employee>?*, the documents to read first (a click opens them), *Approve*, *Ask for a change* (write what should
  change: the station's role works again with it) or *Later*.
- **QA's plan**: QA writes the run's checks and stops. In the drawer, the console lists every check: on or off, its
  station, who runs it, its state; yours to do come first. Switch checks, *Add a check* of your own (a load test, a
  look on a phone), run yours and mark each *Done* or *Failed*; *Go on* opens once every check of yours that is on is
  marked, and QA runs the rest.
- **The spending**: before the first call to a paid provider, two questions of the editor, the second with the
  amount and the providers. *Settings and integrations → Spending* can turn them off, unless you or the project
  (`"forceConfirm": true` in `.nuclear/builder.json`) force them.

*Later*, or closing VS Code, leaves the run waiting; your answer later goes on from there (*Go on* asks again). In a
terminal: `nuclear-builder run --resume <id>`.

## The node, like a debugger

The node shows the station you picked (or the whole run's stations) as a tree of titles: each step with its status,
who did it and how long. Open a step (a click, or → on the keyboard) to see its inner process: its outcome, what its
agent followed, each tool it called (open one for its input and output), the decisions it took (open one for why),
the files it wrote (a click opens the file) and its log, only when you open it. Nothing is open that you did not
open. ↑ ↓ move, ← closes or goes up, Enter opens. *Inside the step* shows the same in the diagram; *‹ The run* (or
Escape) goes back to every station.

## The log and the team

Under the node, one line per step done, newest last: who and what, how long. A click opens its detail (its outcome,
what its agent followed and the tools it called, *show in the node*). Under the log, the team doing the work: its
logo and name and its tech lead; a click opens *Your software company*, where each team is a card (logo, name,
description, its members, what it works on) and opens to its members (each one's name and personality, editable)
and their settings.

## The diagram of a run

The run is a living work diagram in C4's four levels; the breadcrumb walks them, a double click goes down, Escape
goes back up:

- **Context** (where a run opens), the view for whoever asked for the work, a product owner or a stakeholder: what is
  being built (the project and the spec) and five steps in plain words, *Understand the request*, *Design the
  solution*, *Build it*, *Check it*, *Deliver it*, each saying what it produced (the spec and its acceptance criteria,
  the decisions taken, the files written, the checks passed, the pull request) and its state (to come, working, needs
  you, done, stopped). A step that needs you asks you along an edge. *⤢ Inside* (or a double click) goes to the
  stations of that step; who works them, the providers and the budget are there.
- **Stations**: a node per station, left to right (Analysis → Design → Tests first → Code → Quality → Delivery), with
  the employee and the provider and model that work it, its state, time, progress and the step on now. A light runs
  round the station working, one that waits for you breathes in amber, and the edge that hands the work to it flows.
  The view opens on the station working (or waiting, or failed) and its neighbours.
- **Inside a station** (its *⤢ Inside* or a double click): its steps with the employee and model that did each, and
  under each step the steps its agent followed, the last one lit while it works. The stations before and after stand
  at the sides.
- **Inside a step**: what it followed, the decisions it took and why and the files it wrote, as nodes (a spec, a
  decision or an ADR opens as a rendered preview).
- **⚙ Technical details** (top right, inside a station or a step): also the tools the agents called (`Glob`, `Read`,
  `Write`…), for debugging; off, the view says only what was done.
- Nodes can be dragged; the wheel zooms, a drag pans, the minimap shows the whole and the controls fit the view.
- **Click a node** and the node beside the diagram picks it: its steps, each opening to what it did, **the decisions it
  took and why**, its files and its log.

## What each station leaves

Each station writes its documents in the spec's folder (`specs/<component>/[<layer>/]<id>/`) from its role's templates: `analysis.md` and `questions.md`,
`design.md` and `plan.md` (the generators write first what follows from the data, [write a spec, §4](write-a-spec.md)),
`test-plan.md` and the tests, the code with `work-log.md`, `qa-report.md`, then `definition-of-done.md`,
`user-story.md` and `pr.md`. DevOps (the Delivery station) makes the branch, the commit in your name and the pull request only after you
approve; it never merges. The run's drawer lists the documents.

## Run anything again

- *Retry from the failed step*, the main action of a failed run: it goes on from the step that stopped it; every step
  before it is kept, the code the Developer already wrote among them. A test that failed after the code was written
  runs again over that code.
- *Retry this step*, in a failed step's detail: that step and every step after it.
- *Run <station> again*, on every station: it and every station after it run again; the stations before it are kept.
- *Start over…*, on the run: every station from the Analysis, after you confirm.

**Nothing is lost.** What a run takes back (a failed step's files, a station or the whole run run again) is copied first
to `.nuclear/builder/runs/<run>.set-aside/<time>/`, at each file's own path: copy back what you want from there. The
run's *Set aside* lists each copy. Running a station again, a passed step again or the whole run asks you first,
naming how many files the agents wrote go back and where they are kept; *Cancel* is the default. A file you changed
since the run wrote it is kept where it is, and the page says so. The attempt left behind stays under the run with its
reason. A run made by the earlier engine can only start over.

```sh
nuclear-builder retry <run>                          # from the failed step
nuclear-builder retry <run> --step <step> | --from <station> [--yes]
nuclear-builder retry <run> --from <station> --plan  # what it would take back, and where it is kept
nuclear-builder restart <run> [--yes]                # asked in a terminal; elsewhere refused without --yes
```

Over MCP: `developer_retry`.

## When it fails

- A call to the local agents that fails for a passing reason (the service starting, busy, a 5xx) is retried with
  exponential backoff; the settings say how many times and how long. Each retry is in the step's trace.
- When a station fails, the member who worked it reads the failure once (*Why it failed, and the repair*): when it
  can fix it (a document to correct, a check's findings to follow), the station runs once more with that diagnosis,
  by itself; when it cannot, or fails again, the run stops with the diagnosis for you. The diagnosis costs at most
  0.50 USD of the run's budget. *↻ Retry from the failed step* (or `nuclear-builder retry <run>`) goes on from there,
  keeping every step before it.
- Several specs in one run (`nuclear-builder run a.md b.md`): they go one after the other; a failure stops the run on
  that spec, and a retry goes on from it.

## It survives the editor, and it keeps working

- A run is a process of `nuclear-builder`, with a trace log, a heartbeat and a ledger of the files it writes. If VS
  Code closes or crashes in the middle, the run is found interrupted when it opens again, what was left half written
  is undone, and it goes on from that station (`nuclear.builder.resumeInterrupted`). Two windows never run the same
  run. *Stop* interrupts a run that works (what its working steps wrote is undone) and leaves one that waits waiting.
- Every run first checks its connections (the graph, each agent's command, a key in the vault for each API provider,
  the MCP server, free disk; the Developer, Ollama and the local roles' models only for a local role, which no team
  has while the local models are on standby, ADR-platform-0013).
- A run does not stop when you switch tools or close its page. A notification, and a badge on the Nuclear icon,
  tell you when it waits for you and when it ends.
- *Settings and integrations* (`Ctrl+Alt+S`) holds the Smart Graph, the MCP server for Claude Code,
  Codex and Cursor, the connections and the retries.

## The strategy of a request

A whole system, one screen, a rename and a failing test are not done the same way. The graph holds a **strategy**
for each kind of request (33 rows, `strategy:<name>`; ADR-developer-0001): how the kind is recognised, its plan with the
tool of every step, and what it asks of a run. The local **analyst** picks it before anything is generated or
planned (its first step). No model chooses: the request's exact signs decide (a diagnostic code, a test's output, `rename A to B`, a
`GET <url>` line), then its meaning, and whether the project already has the names it writes.

| Family | Kinds of request |
|---|---|
| create | a whole system, a visual prototype with fixed data, a project, a component, a resource of another API, a stored resource, the app of a backend, only an interface, a repository, a use case, a route, one declaration |
| change | one more field, method or action; a rename; a move or an extraction; a break of the architecture's rules; the database's schema; the configuration; taking something out |
| fix | it does not compile; a test fails; it does the wrong thing; it fails while running; the data does not match; a screen shows the wrong thing; the machine or a service fails |
| verify and explain | tests for what exists; a security review; documentation; a question; building, running and shipping |
| beyond | what NuclearLang or the local agents cannot do: said before anything is written |

What a strategy changes in a run:

- **The stations that run.** A compile error skips the generators, the plan and *Tests first*: the compiler's exact
  fixes first (`nuclear fix .`), then each file with errors is repaired with the card of each error. A failing test
  goes straight to *Quality*. A rename plans and writes, and writes no test.
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

## What only you can decide

A check that finds something only you can decide (replacing your CI file, choosing the CI host, a repository to
create) does not fail the run: the station's gate lists it under *Only you can decide*, one short question each, with
the station's own question. QA's *Go on* waits only for your own checks up to Quality: those a gate answers (you
approve the analysis, the design, QA's plan, the push) are marked by your yes there.

