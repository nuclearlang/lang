---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [vision.md, ../02-architecture/engine.md, ../08-guides/follow-a-run.md]
---
# Domain: spec, run, stage, step, actor

## The words

| Term | Meaning | In the code / on disk |
|---|---|---|
| Spec | What is asked: a title, a use case, who leads, a description, the acceptance criteria, optional context files, pieces and strategy | `Spec`; `specs/<id>/spec.md` |
| Use case | The kind of work the form offers: a feature, a refactor, a bug, tests, a security review, documentation, a diagram | `- Use case:` of the spec |
| Lead | Who decides: Claude, or the local agents only | `- Lead:`; `--lead local\|claude` |
| Run | One execution of a spec through the pipeline | `Run`; `.nuclear/builder/runs/<id>.json` |
| Stage | A column of the pipeline | `Stage` |
| Step | One thing one actor did inside a stage, with its trace, input, output, code and decisions | `Step`, `Decision` |
| Actor | Who did a step: you, claude, planner, coder, tester, security, shell, graph | `Actor` |
| Piece | One file to write, with its task | the plan; `## Pieces` of a spec |
| Strategy | The kind of request and the plan of that kind; it decides the stages that run | `Run.analysis`; `- Strategy:` of the spec |
| Journal | The readable record of a run | `.nuclear/builder/runs/<id>.md`; a reviewer's notes in `<id>.review.md` |
| Trace log | Every event of a run, append-only | `.nuclear/builder/runs/<id>.log` |
| Ledger | Every file a run wrote, with what was there before | `Run.writes` |
| Project map | Every declaration of the project with its kind, description and members, written by the transpiler | `.nuclear/map.md` |
| Pipeline settings | The commands of each stage | `.nuclear/builder.json` |

## The stages, in order

Specification → Generate → Plan → Tests first → Code → Verification → Security → Artifacts → Deploy.

The specification ends with the **analysis**, which names the strategy; a strategy may leave stages out.

## The actors

| Actor | Does | Does not |
|---|---|---|
| You | write the spec, choose the context and the lead | write a piece here |
| Claude | plans, fixes what the local coder could not, teaches the graph | write every piece |
| Planner (gemma4:e2b) | splits a spec when no frontier model leads | make architecture decisions |
| Coder (qwen2.5-coder:3b) | writes one file at a time and repairs it with the compiler | choose names, data or architecture |
| Tester | writes the tests first, from the criteria and the plan; fixes a test file the project's check rejects | delete or weaken a failing test |
| Security | reviews each new file | change the code |
| Shell | runs the project's commands | run anything not in `.nuclear/builder.json` |

The local **documenter** writes the top of the journal; the local **diagnoser** tells why a stage failed; the local
**analyst** picks the strategy.

## How the work is split

So that the local 3B models only think the business logic:

1. Before anyone writes, the transpiler has written the **project map**. The agents read it instead of every file,
   so each declaration should have a one-line description (its `//` doc comment).
2. **Tests first**: the tester writes one test per acceptance criterion, with the names the plan gives.
3. **Code**: the coder writes each piece at its place (`nuclear help layout --platform <p>`), with the card of its
   kind, the mistakes to avoid with that kind, examples of it and the project's files that declare the names its
   task writes (it reads them by itself). The compiler checks it, then the whole project.
4. **Verification**: every test runs. A failing test goes back to the coder told in Nuclear (`nuclear explain`:
   the message, a hint and the `.nuc` lines), up to three rounds; when Claude leads, it fixes what is left.

## Invariants

- The local agents only ever see Nuclear and the platform (backend, mobile, web), never Python, TypeScript or Dart.
- A spec needs at least one acceptance criterion.
- Nothing is guessed: a request that lacks a fact its strategy needs stops at the analysis, with the question.
- A bug's repair goes to the file the failure names, whoever wrote it, and never to the test.
- Two processes never run the same run.
- A file the user changed since the run wrote it is never undone.
