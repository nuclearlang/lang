---
status: accepted
date: 2026-11-12
deciders: Julian Molina
---
# ADR-0001: A strategy for each kind of request: the agent recognises what it is asked and follows the plan of that kind

## Context and problem
The local agent treated every request the same way. The planner had one prompt for everything, and the Builder ran
the same nine stages for a whole system, a rename and a compile error: a bug went through *Generate*, *Plan* and
*Tests first* as if it were a feature. The spec's `Use case` field was kept and changed nothing. The knowledge
base (ADR-graph-0001) had its playbooks, found only when someone searched for them. And the generators (old
ADR-0103), which write most of a feature without a model, were reached only by a spec that wrote a `GET <url>` line
or a `Resources` section: a request in plain words ("an order has a total and a status") went to a 2B model, which
planned badly.

A small model follows steps better than it chooses them. So choosing what to do with a request cannot be the
model's work.

## Decision
**A strategy is a row of the knowledge base** (`strategy:<name>`, type `strategy`, on the playbooks shelf): one per
kind of request a user makes. It holds how the kind is recognised (exact signs as regular expressions, trigger
words, the ways people ask), its plan step by step with the tool of every step, and what it asks of a run (its
mode, the stages of the Builder it runs, where its pieces come from, the generators it calls, the facts it cannot
start without, whether it needs a frontier model as lead). Changing how a kind of request is handled is changing a
row, never code.

**The kinds of request**, in five families:

| Family | Strategies |
|---|---|
| create | `system`, `project`, `component`, `resource-api`, `resource-db`, `client-of-backend`, `interface`, `repository`, `usecase`, `endpoint`, `declaration` |
| change | `member`, `refactor-rename`, `refactor-move-extract`, `refactor-architecture`, `data-migration`, `configuration`, `remove` |
| fix | `bug-compile`, `bug-failing-test`, `bug-behaviour`, `bug-runtime`, `bug-data-contract`, `bug-interface`, `bug-environment` |
| verify and explain | `tests`, `security-review`, `document`, `question`, `operate` |
| beyond | `beyond` |

**The selection asks no model.** An exact sign of the request outweighs any closeness of meaning; meaning decides
between strategies with no exact sign, or the same ones; whether the project has the names the request writes moves
the score. The answer says which signs chose the strategy. A run of the Builder cannot follow a strategy without
stages (a question, a command): such a strategy comes first for a run only when an exact sign chose it. A spec may
name its strategy itself (`- Strategy: usecase`).

**The analyst** runs before anything is generated or planned, in fixed steps: the project's files say which names
of the request exist; the graph gives the strategy; the strategy gives the stages, the source of the pieces and the
facts it needs. A model is asked for one thing only: the resources a request in plain words describes. Each line
becomes a `nuclear gen resource` call and is kept only if its `--dry-run` accepts it. A fact the request lacks is
a question for the user and stops the run: nothing is guessed.

**Tools before models, in every strategy.** A generator writes what is standard; the compiler's exact fixes
(`nuclear fix`) come before any repair; a rename is done by a tool (every file that writes the name as a word, and
with it the project's names built from it) and no model writes; the files a change starts in are found by the
project's declarations, not planned. A model writes only a piece of one file that no tool can write.

**The Builder follows the strategy.** The analysis is the last step of the *Specification* stage. Then the stages the
strategy has no use for are skipped; *Generate* runs the spec's own resources and the calls the analysis derived;
*Plan* takes the pieces the tools gave, and asks the planner only when the strategy's pieces come from a plan;
*Code* writes a piece a tool already wrote as it is, and afterwards wires each use case the coder wrote with
`nuclear gen usecase`; *Verification*, for a bug, repairs the file the failure names whoever wrote it, and never
the test. A Developer without an analyst leaves the run as it was: every stage.

**The classification is tested like the rest of the knowledge base.** `questions.toml` holds requests in English
and Spanish (`request = true`), none of them among the `asks` of its row; `nuclear-graph knowledge ask` gives each
to the selection and its first strategy must be the expected one.

**A generator finishes what it starts on a resource that exists.** `nuclear gen resource` with a new action adds
the repository's method and the controller's route too (merged member by member); it refuses a search of a stored
resource, because which column is searched is a decision.

## Options considered
1. One prompt and one pipeline for every request: what was there.
2. A model classifies the request and chooses the steps: a small model follows steps better than it chooses them.
3. Rows of the knowledge base, one per kind of request, chosen by exact signs and then by meaning.

## Consequences
- Positive: a request in plain words reaches the generators, each call shown before it runs.
- Positive: a compile error is repaired without planning; a failing test without generating; a rename without a
  model.
- Positive: a run says which kind of request it understood and why, at its first stage: a wrong reading is seen
  before any file is written, and the spec can name the right strategy.
- Positive: a lead model gets the same routing (`graph_strategy`) and the same plans.
- Positive: adding a kind of request, or changing how one is handled, is a row and its test requests.
- Negative: the selection reads words. A request that names its kind in an unusual way is classified by meaning
  alone, which a small embedding model does less well than an exact sign.
- Negative: `refactor-move-extract`, `remove` and `beyond` need a lead: the local agents do their mechanical steps
  only.
- Negative: a rename by the tool covers declarations and the names built from them, not fields or methods; the
  file of a renamed declaration keeps its path; a rename runs no security review.
- Negative: a bug whose failure names only its test stops at *Verification*: where the cause is needs a lead or
  the user.
- Negative: a model asked about a request that lists no field invents them, so the analyst's one model call is
  made only when the request lists some, and its answer is held to that list.

## References
- Replaces: ADR-0105
- The AI loop: ADR-platform-0003. The generators: ADR-codegen-0001. The library the rows live in: ADR-graph-0001.
- State: `../02-architecture/strategies.md`; the selection: `nuclear-graph-storage/docs/02-architecture/search.md`.
