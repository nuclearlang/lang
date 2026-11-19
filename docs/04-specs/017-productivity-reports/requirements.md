---
status: draft
owner: Julian Molina
updated: 2026-11-18
related: [../011-software-factory/requirements.md, ../013-nuclear-chat/requirements.md, ../../03-adr/0009-the-ui-is-only-a-ui.md]
---
# Spec 017: Productivity and consumption reports — Requirements (draft)

## Goal

The user wants to know what each agent, member and team spends and produces: tokens, money, time, lines of code,
and whether the work passed. Asked on 2026-11-18; the plan is written after the work in progress ends.

## Philosophy

- **Measure what is already recorded.** A run already keeps each step's cost, time and the files it wrote; Nuclear
  Chat keeps each answer's cost. Add what is missing (tokens) at the source, never estimate it after.
- **The same numbers for people and agents** (ADR-platform-0009): a report the page shows is a command and an MCP
  tool, so an agent answers "how much did the team spend this week?".

## Requirements (first version)

1. **Every step and every chat answer keeps**: tokens in and out (from the provider: Claude Code's usage, OpenCode's
   step costs, the APIs' usage, Ollama's counts for the local agents), cost in USD, time, lines added and removed
   (from the run's ledger), the result (passed, failed, retried, tests).
2. **By agent and model** (Claude Code · haiku against the local agents), **by member, by team, by project and by
   period**.
3. **Derived indicators**: cost per delivered spec, tokens per useful line, local against paid, retries per station.
4. **`nuclear-builder metrics`** (JSON) and its MCP tool.
5. **A report with charts** in the platform's HUD style: consumption over time, members ranked by cost and by result,
   local against paid, the same by team and by project; and each member's numbers in their panel's Summary.

## Open

- Where the history of every run across projects is kept and for how long; export (CSV); budgets and alerts.
