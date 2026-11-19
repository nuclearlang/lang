---
status: accepted
owner: Julian Molina
updated: 2026-11-19
related: [requirements.md, tasks.md, ../011-software-factory/design.md, ../013-nuclear-chat/design.md]
---
# Spec 017: Productivity and consumption reports — Design

## The parts

| Part | Where | What |
|---|---|---|
| The usage at the source | `extensions/tools/nuclear-builder/adapter*.nuc`, `api_*.nuc`, `member.nuc`; the Nuclear Developer | every provider call gives `usage: {inTokens, outTokens, costUsd, ms, provider, model}`; each run step and chat answer keeps it |
| The ledger | `nuclear-builder` (Nuclear), `~/.config/nuclearlang/factory/ledger/<yyyy-mm>.jsonl` | one line per step and per chat answer, across projects, appended: who (team, member, employee, role), what (project, spec, run, station, step or channel), usage, lines added/removed, result |
| The reports | `nuclear-builder metrics [--project] [--team] [--member] [--from --to] [--by day\|week] --json`, MCP tool `metrics` | the Jira-like views and the bill, computed from the ledger and the run files |
| The page | the VS Code tool *Reports* (`extensions/tools/nuclear-builder/src/reports/`), the strip's icon | charts in the HUD style; each member's Summary shows their numbers |

## The numbers

- **Tokens and money**: from the provider — Claude Code's `usage` and `total_cost_usd` (stream-json), OpenCode's step costs and tokens, the APIs' `usage`, Ollama's `prompt_eval_count`/`eval_count` for the local agents (cost 0, time real).
- **Lines**: from the run's ledger of writes (each file's text before and after): added and removed per step.
- **Time**: each step's start and end; a station's time; a spec's cycle time (written → delivered or stopped); time waiting for the user (a gate opened → answered).
- **Result**: a step passed, failed, retried; a station passed at the first try or after repairs; a spec delivered.

## The views

- **Bill**: tokens in/out and USD by day, by provider · model, by team, by member, by project; local against paid; budget used per run.
- **Throughput and velocity**: specs delivered per day/week, per team.
- **Cycle time**: per spec and its distribution; time per station.
- **Burndown / burnup** of a period's specs.
- **Cumulative flow**: specs by station over time.
- **Waiting for you**: open gates, how long.
- **Quality**: failures and retries per station, first-try pass rate.
- **People**: each member's steps, lines, passes/fails, tokens, cost; ranking by cost and by result.
- **Indicators**: cost per delivered spec, tokens per useful line (lines kept in the delivery).

## Rules

- Measured, never estimated: a provider that gives no tokens shows "not reported", not a guess.
- The ledger is the user's, outside the extension's storage; nothing leaves the machine.
- The UI is only a UI (ADR-platform-0009): the page reads `nuclear-builder metrics`, which agents read too.
