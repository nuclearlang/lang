---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [domain.md, ../02-architecture/overview.md]
---
# Vision

## Problem
Work with AI agents should start from a spec and end in tested, reviewed code, on the developer's machine, with
every step visible. The same pipeline must be able to run on a server.

## The idea
A frontier model like Claude makes the decisions (the plan, the names, the review) and the local developer writes
each piece. A lead hands work to a junior the same way. What the junior cannot fix, Claude fixes and keeps as an
example, so the junior gets it right next time.

## The three pieces

| Piece | What it is | Project |
|---|---|---|
| Nuclear Smart Graph | A private library of the whole ecosystem, as cards on shelves: what it is for, how each thing is written, every kind, tool and error, what can and cannot be done, how each task is done, validated code. Plus the MCP server of NuclearLang for Claude Code, Codex or Cursor | `nuclear-graph-storage/`, `tools/mcp/` |
| Nuclear Developer | Local agents on 3B models: a coder, a tester, a security reviewer and a planner. They search the graph and check their answers with the compiler | `nuclear-agents/nuclear_developer/` |
| Nuclear Builder | The pipeline: a spec goes through its stages, and every step shows who did it | this project |

## Users
- A developer in VS Code (`Ctrl+Alt+P`) or Android Studio / IntelliJ (`Alt+Shift+P`).
- A terminal or a CI job: `nuclear-builder`.
- A frontier model over MCP: `developer_task` runs this pipeline with the local agents and answers the journal
  ([the MCP server](../../../../../tools/mcp/AGENTS.md)).

## Who leads, and why
*Claude leads, the local developer writes* is the default; *Local agents only* is the other choice.

The local developer is measured against Claude Sonnet on a bank of 45 tasks, 18 of them held out: 42 single files of
every platform and 3 features of several files. On single files the local 3B coder is at Sonnet's level (36 against
36). On whole features it is behind: it passes one of the three by itself, while Sonnet passes all three. That is
why Claude leads by default: it plans and fixes, the local developer writes the pieces. The method, every round and
every task are in [the Developer's README](../../../../../nuclear-agents/nuclear_developer/README.md).

## What it does not do
- It does not run in Zed.
- The shell runs nothing that is not in `.nuclear/builder.json`.
- The agent stages do not run on a server: the server checks their result with the deterministic stages.
- The acceptance step informs; it never fails a run.
