---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [testing.md, ../06-runbooks/evaluation.md, ../02-architecture/models.md]
---
# The rounds of the evaluation

What each round of the evaluation changed and what it measured, local against Claude Sonnet
([the method](testing.md#evaluation-how-it-was-trained)). A new round is a new row. The table task by task of the
last round is `eval/results/REPORT.md`.

## The bank of 32 tasks (12 held out)

| Round | What changed | Local / Sonnet (all 32) | Local / Sonnet (12 held out) |
|---|---|---|---|
| 1 | the ingested knowledge only (Sonnet's references were still running: its numbers here are partial) | 23 / — | 9 / — |
| 2 | + 15 distilled Sonnet examples | 26 / 25 | 8 / 10 |
| 3 | + 7 rules in the coder's guide (decorators above their field, `gte(...)` in queries, graph nodes, `replaceAll`...); two acceptance texts that were wrong for both models fixed | **28 / 26** | **10 / 11** |

## The bank of 45 tasks (18 held out)

| Round | What changed | Local / Sonnet (all 45) | Local / Sonnet (18 held out) |
|---|---|---|---|
| 4 | + 10 mobile and web tasks, 3 features; the web platform's brief (Sonnet 0/4 → 4/4 on web); `nuclear new`'s mobile skeleton fixed; N0116 through runtime classes, N0013 for a dangling decorator | 38 / 39 | 14 / 17 |
| 5–7 | the planner: paths from the platform's `[layout]`, kinds and forgotten pieces from the spec's words, the spec's sentence in each task; the coder's rule "only what the task declares" | 38 / 39 | 14 / 17 |
| 8–9 | a feature distilled as one example per file (a whole-feature example made the coder write every file into each piece) | 37 / 39 | 14 / 17 |
| 10–11 | the agents write only Nuclear (`platform`, the graph's `nuclear` collection, the platform sheets); each piece's task is the spec's own sentence; few-shots (aliases, columns, `replaceAll`, state models, a test file); the entity by folder accepted | 37 / 39, first feature passed | 13 / 17 |
| 12 | void: an `ingest` run from the wrong folder had emptied the graph (fixed: an ingest removes only its own roots' sources) | (29 / 39) | (8 / 17) |
| 13 | every prompt moved to a file (`prompts/agents/*.md`, the same text) on the re-ingested graph | **38 / 39** | **15 / 17** |
| 14 | void: `/tmp` filled up during the run | — | — |
| 15 | the tester: only the plan's names, nothing to inject for models, a search without `inject`; errors by line | **38 / 39**, 1 of 3 features | **15 / 17** |
| 16 | void: stopped at 10 minutes while another agent held Ollama | — | — |
| 17 | the words of the kinds in Nuclear only (`[underneath]` for the framework), the compiler gaps fixed | 37 / 39, 1 of 3 features | 14 / 17 (`entity-reader`: the decorator written after its field, not repaired) |
| 18 | the graph as a library (`ADR-graph-0001`): the coder reads the card of its kind, the pitfalls of that kind and examples; a repair reads the card of each error code; both quote styles score as the same string | 39 / 39, 1 of 3 features | 16 / 17 |
| 19 | the planner reads how people write a kind from the graph ("application component"); the coder holds its answer to the task's words | **40 / 39**, 2 of 3 features | **16 / 17** |
| 20–21 | measured and discarded: the coder's guide without its general rules and shapes (only the kind's own rules, from the graph): it gained the state model and a graph and lost `replaceAll`, a renamed method and a service's shape | 39 / 39, 1 of 3 features | 14 / 17 |
| 22 | the general rules stay in the guide and every rule of the kind comes from the graph (the two closest whole, the rest in a line); examples of the same kind only; the answer held also to the signatures the task writes | **43 / 39**: every task of one file passes (42 of 42), 1 of 3 features | **16 / 17** |
| 23 | the answer held also to the signatures without parameters (`all()`) | **43 / 39**, 2 of 3 features | 16 / 17 |

## What the rounds say

- On single files the local 3B coder passes every task of the bank in round 22 and all but one in round 23 (42 and
  41 of 42; Sonnet 36).
- On features of several files written by the local agents alone it passes one or two of the three, depending on
  the round, where Sonnet passes all three: a piece renames a method the spec writes, or two pieces declare the
  same thing. That is why a feature goes through the generators first and, when it has a design of its own, under
  a lead.
- Holding the answer to the order's words fired four times in round 19 and changed no answer: it exists for the
  short orders of a lead, where a renamed call breaks the next piece.
- Measured and discarded: giving the coder the file `nuclear make` writes (29 of 42 against 37); the coder's
  guide without its general rules (rounds 20–21).
- Each local answer takes 1.5–10 s on the CPU, a feature 1–1.5 min.
- The references cost USD 0.89 for the 45 tasks.

## The analyst

First measure of `run.py analyze`: **10 of 11**, 4 of the 5 that ask the model. The one that fails drops a field
twice, and then asks the user for the fields instead of generating.
