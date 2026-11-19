---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0009: The UI is only a UI: every action is a command, and a tool for the agents

## Context and problem
The user asked the Builder's chat to "read these slides, write every spec, then write the code through the
Builder", and the agents could not: some actions lived only behind a button of the page (start a run, answer a
gate, hire a member, change a setting of the line). The user's rule: "the UI is just that, a UI"; the agents must be
able to do absolutely everything the graphical tool does.

## Decision
1. **Every action of a tool is a command of its engine** (`nuclear-builder … --json`, Nuclear), with its validation
   and its rules there; a page only draws and calls those commands. No action is written in a page or in the
   extension's host.
2. **Every command is a tool of the tool's MCP server**, the same name and arguments: the Builder's is
   `nuclear-builder mcp` (stdio), beside `nuclear-mcp`. The factory gives it to every agent it runs (a role's
   provider, a chat member, an API model's loop), so whoever works in the chat can do what the user can do with the
   mouse.
3. **What is the user's stays the user's.** A tool that spends money waits for the two confirmations (spec 011,
   requirement 16, with *force confirmation*), asked of the user, never answered by an agent; a tool that destroys
   (delete a team or a spec, undo a run) asks the user too; the merge of a pull request is never a tool.
4. **A test holds the three together**: every action of the pages names its command, every command is an MCP tool,
   and every tool is documented.

## Options considered
1. Give the agents the page (a browser agent clicking): slow, fragile, and the rules would live in the page.
2. A second set of agent-only endpoints: two implementations of every action.
3. One command per action, the page and the agents its two clients.

## Consequences
- Positive: an agent can run the whole factory from a conversation; the editors stay thin; JetBrains gets every
  action by calling the same commands.
- Negative: every new button costs its command, its tool and its test first.

## References
- Follows: ADR-platform-0007 (components), ADR-platform-0008 (Nuclear Chat)
- Spec: [011](../04-specs/011-software-factory/requirements.md), requirement 32
