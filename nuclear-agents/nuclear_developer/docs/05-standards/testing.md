---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [evaluation-rounds.md, ../06-runbooks/evaluation.md, ../02-architecture/models.md]
---
# Testing

**A change to an agent, or to a prompt of the graph, is measured**: run the evaluation and keep the report. The
project's own tests check the code; the evaluation checks what the agents answer.

## The project's tests

| What | Command | Needs |
|---|---|---|
| The compiler | `nuclear check . --json` reports no errors | — |
| The tests in Nuclear (`test/analyst_test.nuc`, `test/workbench_test.nuc`) | `nuclear test` | the graph running (`nuclear-graph serve`) |
| The generated Python, strict | `cd build && ../../../nuclearlang/tools/python/.venv/bin/pyright --pythonpath .venv/bin/python app` → 0 errors | `nuclear install` |

## Evaluation: how it was trained

There is no dedicated GPU here, so the agents are not trained by changing weights: they are trained by **retrieval
and distillation**, measured by `eval/run.py` over the tasks of `eval/tasks.toml`, each with acceptance texts
(`must`): 42 tasks of one file (every backend kind, and the mobile and web platforms) and 3 **features**
(`[[feature]]`) of 4–6 files that the planner splits, the coder writes piece by piece (each with the pieces before
it as context, and one repair pass with the project's errors) and the compiler checks together as a fresh
`nuclear new` project:

1. `reference`: Claude Sonnet answers every task once, with the same guide and the dialect's sheet, and one repair
   with the compiler's errors (USD 0.89 for the 45). A feature is one answer with every file.
2. `distill`: the Sonnet answers of the `train` tasks that pass become examples in the graph's `examples`
   collection (a feature as one example per file). The 18 `test` tasks are held out: their answers never reach the
   graph, so the test score measures what the graph teaches, not what it copied.
3. `local`: the local coder answers every task through the Developer. An answer passes when `nuclear check` reports
   no errors and it has every acceptance text. The local developer is **equivalent** to Sonnet on a task when both
   pass.
4. A failure is studied and fixed with a **general rule or more knowledge** in the graph (never the answer), then a
   new round.

The local agents write Nuclear for a platform; the dialect of a task only builds the reference's check.

**The analyst** (`ADR-developer-0001`) is measured apart: `run.py analyze` gives eleven requests, as a user writes
them in English and Spanish, to `/developer/analyze` in a fresh project (`[[analysis]]` in `tasks.toml`) and checks
the strategy each gets, the `nuclear gen` call a request in plain words becomes, the pieces the tools give, the
questions it asks and the stages that run. Which strategy a request gets asks no model: it is tested with the
knowledge base (`nuclear-graph knowledge ask`: 62 requests, all to their strategy).

**The assistant** is measured with `run.py chat`: the questions of the knowledge base's `questions.toml` that
carry `says` are asked to `/developer/chat` as the editor's chat does; an answer passes when it contains every one
of those texts.

## Where it stands

- Single files: the local 3B coder passes every task of the bank in round 22 and all but one in round 23 (42 and
  41 of 42; Sonnet 36). All 45: local 43, Sonnet 39; held out: 16 of 18, Sonnet 17.
- Features of several files, by the local agents alone: one or two of the three, depending on the round, where
  Sonnet passes all three.
- The analyst: 10 of 11, 4 of the 5 that ask the model (the one that fails drops a field twice, and then asks the
  user for the fields instead of generating).
- Each local answer takes 1.5–10 s on the CPU, a feature 1–1.5 min.

Every round and what it changed: [evaluation-rounds.md](evaluation-rounds.md). The table task by task:
`eval/results/REPORT.md`. Other models in the place of the two in use:
[models.md](../02-architecture/models.md#models-measured).

## Rules

- A failure is never fixed with the answer of its task: a general rule, or a row of the knowledge base.
- The held-out tasks never reach the graph.
- The models stay at 3B parameters or less.
