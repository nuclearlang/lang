---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md, apps.md]
---
# Spec 020: The benchmark — Tasks

Who: **agent** (in the tree), **user** (accounts, keys, money, decisions).

## Phase 0 — Prepared

- [ ] T0.1 user: API keys and a budget for the run (Anthropic, DeepSeek, Google, xAI, Cursor), and the decision of
      the exact models of each tier on the day.
- [ ] T0.2 agent: the `benchmark/` project skeleton (AGENTS.md, docs/, nuclear.toml), the container images (base,
      +nuclear from the public installer, +native toolchains).
- [ ] T0.3 agent: the harness in Nuclear, reusing Nuclear Builder's providers as a library (one command per run,
      caps, recording, `result.json`).
- [ ] T0.4 agent: A1 and A2 specified, their hidden tests and scoring; reviewed by the user (and a FastAPI-fluent
      reviewer when one is available).
- [ ] T0.5 agent: the prompts per condition, frozen; the pre-registration (hypotheses, metrics, analysis) committed.

## Phase 1 — Pilot (round 0, not published)

- [ ] T1.1 agent: 2 models (Haiku, DeepSeek) × N/B × A1, A2 × 2 runs; fix the harness, tests and caps.
- [ ] T1.2 agent: the report generator (tables, bootstrap intervals, SVG charts).

## Phase 2 — Round 1 (published at the launch)

- [ ] T2.1 agent: A3, A4, A6 specified with their tests, load tests and mocked model server.
- [ ] T2.2 agent: round 1 run (all models × N/B × A1-A4, A6 × 5).
- [ ] T2.3 agent: REPORT.md, the website's benchmark page, the numbers for the READMEs and the press kit (spec 019).
- [ ] T2.4 agent: each failed Nuclear run's cause filed in the roadmap of the project at fault.

## Phase 3 — Round 2 (the full answer)

- [ ] T3.1 agent: A5, A7, A8, the change tasks and the port task, with their tests.
- [ ] T3.2 agent: round 2 run (+ the N0 ablation, the Opus ceiling, the local 3B floor).
- [ ] T3.3 agent: the report answering H1-H7, published whatever it says.

## Phase 4 — The leaderboard

- [ ] T4.1 agent: each new model measured on A1-A4 (N/B × 5) and added to the website's leaderboard.
