---
status: accepted
owner: Julian Molina
updated: 2026-11-19
related: [README.md, ../02-architecture/reports.md, make-a-team.md]
---
# Read what the factory spent and made

Every step of a run and every answer of Nuclear Chat writes one line in your factory's ledger
(`~/.config/nuclearlang/factory/ledger/`, on your machine only): who did it (the team, the member, the role), where
(the project, the spec, the station or the channel), the tokens and the money the provider reported, the time, the
lines of code it added and removed, and whether it passed. The reports read that ledger, for every project of the
machine.

## In VS Code

Open **Reports** on the Nuclear workspace's strip (the bar chart with a coin, `Ctrl+Alt+K`), or the command *Builder
Reports: What the Factory Spent and Made*.

- **The bill**, on top: tokens in and out, the money spent, local against paid, the budget the runs used, and tokens
  and money by day or week.
- **The tabs**, the reports of a sprint: *Throughput* (specs delivered by period, velocity by team), *Cycle time*
  (each spec from its run's start to its delivery, and the time per station), *Burndown* (the period's specs left and
  delivered), *Flow* (where the specs were at the end of each period), *Waiting for you* (the gates open now and how
  long), *Quality* (failures, retries and the first-try pass rate per station), *People* (each member's work, ranked
  by cost or by result) and *Indicators* (cost per delivered spec, tokens per useful line, the local share).
- **The filters**: a project, a team, a member, the dates, by day or by week.

A member's numbers are also in their panel's **Summary** on *Your software company*; its *Reports* button opens the
page filtered to them.

## In a terminal or for an agent

```sh
nuclear-builder metrics                                   # the bill and the main numbers
nuclear-builder metrics --team red --by week --json       # every report of a team, by week
nuclear-builder metrics --view people --from 2026-11-01   # each member's work since a date
```

An agent asks the same with the MCP tool `metrics` ("how much did the team spend this week?").

## What the numbers mean

- **Measured, never estimated.** The tokens are the provider's own counts (Claude Code's usage, OpenCode's steps,
  Codex's and Gemini CLI's turns, the APIs' usage, Ollama's counts for the local agents). A provider that reports none
  (Cursor and Grok Build today) is counted as *not reported*, not as a guess.
- **Local against paid**: the local agents cost nothing in money; their tokens and time are still counted.
- **Runs of before**: the runs a project made before this version are copied into the ledger once, with what their
  files had (their money and times; no tokens nor lines).
