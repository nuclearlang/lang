---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../00-context/domain.md, ../01-product/roadmap.md]
---
# The engine (`engine.ts`, `safety.ts`)

Neither file imports `vscode`: the page, `nuclear-builder`, Nuclear Atlas's `/task` and `test/engine.test.ts` (node:test)
drive the same code.

## A run through its stages

`BuilderEngine.start()` runs spec → generate → plan → tests first → code → verify → security → artifacts → deploy, and
saves `.nuclear/builder/runs/<id>.json` on every step. Each `Step` has an `Actor`.

- **Spec.** Writes `specs/<id>/spec.md`. `criteriaOf` reads the list under "Acceptance criteria".
  `suggestContext` ranks the project's and the user's `.md` files by the words of the spec: agent instructions
  first, then specs, context, ADRs, skills and agent definitions. Its last step is `analyze()`: it asks
  `/developer/analyze` and keeps the answer in `Run.analysis` (the strategy of the request, ADR-developer-0001).
  `Spec.strategy` is the spec's `- Strategy:` line.
- **Generate** (ADR-codegen-0001). `specResources` (the spec's `## Resources`, or its `GET <url>` lines) go through
  `nuclear gen resource ... --from-spec`; the analysis's `generate` calls join them in `generateStage`, through
  `gen()`. The changed files are found by `nucFiles` snapshots and put in the write ledger (`Step.files`).
- **Plan.** The planner gets `generatedNote()`, and `withoutGenerated` drops a piece that repeats a generated file.
  The analysis's `pieces` are the plan when the tools gave them; a piece with `code` is written as it is.
  `planKept()` keeps the pieces the user wrote and drops the planner's when a plan is made again.
- **Tests first.** The tester; skipped when the generators wrote every file.
- **Code.** Each piece by the coder (Claude takes the ones it leaves with errors and keeps the fix as a graph
  example), then `commands.check`. A project error gets one local repair per file (`repairProject`), then Claude.
  `wire()` runs `nuclear gen usecase` for each use case the coder wrote.
- **Verify.** `verifyStage` repairs the file a failure names for `mode: fix`, never a test. After a passing
  verification `accept()` asks `/developer/accept` (`Run.acceptance`, never a gate).
- **Security, artifacts, deploy.** The security reviewer on each new file; the project's commands.

The analysis's `stages` skip the others in `stages()`. `decide()` records a step's `decisions` (`Decision`: what,
why).

## Running again

| Call | What it does |
|---|---|
| `start(from?, step?)` | a run again: from its first failed stage, from a stage (`from`), or from one step by its id (`step`: it and every step after it; the ones before it are kept) |
| `restart()` | from scratch |
| `guard()` | refuses a run that is running |
| `undo()` | puts back what the steps left out wrote (`builderSafety.rollback`); a file whose `digest` is not the one the write left is kept and named |
| `forget()` | moves the steps left out to `run.previous`, with the reason |
| `upgradeRun()` | gives a run of an older `ENGINE` (2 today) today's stages and makes its next retry a restart |
| `restoreWritten` | reads the written files back |

## Retries and diagnosis

- `backoff`: exponential with full jitter, capped; `Retry-After` wins. `transientStatus` says what may pass on a
  second try; `config.retry` holds the tries and the waits. Each retry is written in the step's trace.
- `diagnose()` asks `/developer/diagnose` when a stage fails and keeps the answer in `run.diagnosis`.
- A failed command's line in the log is the compiler's first error and where, not the last line of its output; a
  full disk names the folder that is full.

## What keeps a run safe (`safety.ts`, ADR-platform-0003)

- `atomicWrite`: the run's state is never half written.
- `trace` / `readTrace`: every event, as JSON lines, append-only.
- `owner` / `alive` / `orphaned`: the process that runs a run beats every `BEAT_MS` (10 s); a heartbeat older than
  `STALE_MS` (45 s) means its owner stopped.
- The ledger (`Run.writes`): every file the run writes, with what was there before (`writeFile` keeps it);
  `rollback` undoes it.
- `checkConnections`: the services, the models, the tools' `--version`, `freeMb`. `ollamaBusy` (`/api/ps`).

In the engine:

- `start` refuses a run another live process owns, recovers an orphaned one, beats, and runs `preflight` (*Check the
  connections*: the Developer, the graph, Ollama and the models, Claude when it leads, free disk) before the first
  stage it runs.
- `watched` cuts a call (`StallError`) after `callTimeoutMs` (15 minutes by default), or after `stallSeconds` (90)
  with neither the Developer nor a model working on it; the call is retried.
- A command gets `commandTimeoutMs` (20 minutes): `TIMED_OUT`, and its process group is killed.
- `recoverRun` / `recoverRuns`: what an interrupted run left half written is undone, and it goes on from that step.
  In VS Code, `resumeOrphans` does it on activation (`nuclear.ai.resumeInterrupted`), with a notification.

## Sources of a spec

`jiraIssue` / `jiraMine` (REST v3, ADF to text), `githubIssue` (`gh issue view`). `specMarkdown` writes a spec as
markdown and `parseSpecMarkdown` reads it back.

## CI

Commands are data: `.nuclear/builder.json` (`defaultConfig(platform)`). `ciFile()` exports the deterministic stages to
GitHub Actions, GitLab CI or Bitbucket Pipelines; `ciCommands` groups them the same way for `nuclear-builder ci`.
