---
status: approved
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, apps.md, tasks.md]
---
# Spec 020: The benchmark — Design

## The project

A new project of the tree, `benchmark/` (its own `AGENTS.md` and `docs/`), a Nuclear project (python dialect):

```
benchmark/
  apps/<id>/spec.md            the specification the agent gets (prose, stack-neutral)
  apps/<id>/tests/             hidden tests (pytest for HTTP, Playwright for web, the Flutter driver for mobile)
  apps/<id>/load/              k6 scripts and budgets
  apps/<id>/changes/           the change requests (H6) and seeded defects
  harness/*.nuc                the runner: containers, the agent CLIs, the caps, the recording
  images/                      the container images: base, +nuclear (public installer), +native toolchains
  prompts/                     the frozen prompts per condition
  results/<round>/             raw runs (transcripts, code, reports) and REPORT.md
```

## The harness

1. `bench run --app A2 --agent claude --model haiku --condition N --runs 5` starts, per run, a fresh container
   from the condition's image, mounts an empty project folder, writes the spec and the prompt, and starts the agent
   headless with the caps:
   - Claude Code: `claude -p --model <id> --max-turns <n> --output-format stream-json` (tokens and cost in its
     result).
   - OpenCode: `opencode run -m <provider/model>` with the session export (its usage per message).
   - Cursor: its `agent` CLI with `-p --model <id> --output-format json` (Composer and Grok as its model ids).
   - The Nuclear Developer: its MCP tool `developer_task`.
   The conditions differ only in the image and the prompt's first line ("use NuclearLang" vs "use FastAPI").
2. When the agent stops (done, cap, timeout), the harness builds and starts the app the way its condition says
   (`nuclear run` / `uvicorn` / `npm start` / the Flutter driver), runs the hidden tests, the load test and the
   security scan, and writes `result.json` (scores of apps.md) next to the transcript.
3. `bench report <round>` aggregates: tables, bootstrap intervals, paired differences, charts (SVG for the website).

The provider CLIs and their token accounting already exist in Nuclear Builder's providers (Claude Code, Codex,
Cursor, Grok Build, Gemini CLI, OpenCode): the harness reuses that code as a library (ADR-platform-0007), not a
copy.

## Caps (per run)

| App size | Wall time | Turns | Dollars |
|---|---|---|---|
| medium (A1) | 30 min | 80 | 2 |
| hard (A2-A7) | 90 min | 200 | 6 |
| hardest (A8) | 180 min | 400 | 12 |

A run that hits a cap is scored with what it left (often zero): the cap is part of the result (cheap models are
judged on what they deliver within a budget a person would pay).

## The rounds

| Round | Apps | Cells | Purpose |
|---|---|---|---|
| 0 (pilot) | A1, A2 | 2 models × N/B × 2 runs | shake out the harness, the tests, the caps; not published |
| 1 | A1-A4, A6 | all models × N/B × 5 | the first published result (the launch, spec 019 phase 4) |
| 2 | A5, A7, A8 + changes + port | all models × N/B/N0 × 5 | the full answer to H1-H7 |
| each new model | A1-A4 | that model × N/B × 5 | the leaderboard |

Rough cost of round 1: 5 apps × ~8 model cells × 2 conditions × 5 runs = ~400 runs; with cheap models at
$0.10-$1 and mid models at $1-$5 per run, about $500-$1 000 in API spend (the dominant cost is Sonnet and the Opus
ceiling). The pilot costs under $50.

## Threats to validity, and what is done about each

| Threat | Mitigation |
|---|---|
| Models know Python/TypeScript from training and Nuclear not at all | that is the real world Nuclear lives in; the result is what a user gets today; N0 separates the language from the MCP server |
| The Nuclear prompts are better tuned than the baseline's | prompts frozen and reviewed by stack-fluent reviewers; published |
| The hidden tests favor one implementation | black-box behaviour only; written from the spec before any run; reviewed by someone who did not write the Nuclear runtime |
| Nuclear's own developers built the apps' platform features | the apps are taken from common real-world needs, not from Nuclear's examples; none is in the knowledge base's examples |
| Provider variance and caching | 5 runs, fresh containers, caches disabled where the CLI allows, dates and versions recorded |
| Contamination of later rounds (the apps become public) | each round adds new held-out apps; the leaderboard keeps a private set |
| A cheap model fails on the harness, not the task | the pilot; a run that dies from the harness is rerun and logged |

## How results feed the project

Every failed Nuclear run is classified by cause (a missing word of a dialect, a wrong doc, an MCP tool missing, a
compiler error that did not say how to fix it), and each cause becomes a roadmap item of the project at fault, so
the next round measures the improvement — the same loop as the local developer's evaluation
(`nuclear-agents/nuclear_developer/eval`), at the scale of whole applications.
