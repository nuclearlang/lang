---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0007: Everything is a component, as in a framework

## Context and problem
The tools of the platform grew features inside themselves: the Builder had its own chat, Nuclear Atlas another;
each one with its code, its texts and its documents. The user asked to work "always thinking as if everything were
a framework, and ordered": a piece more than one tool needs must not be written twice nor live inside one of them.

## Decision
1. **A piece that two tools need is a component of its own**: a project with its folder, its `AGENTS.md`, its
   `README.md` and its `docs/` layers (docs/README.md), its own ADR key and its own tests. The tools use it as a
   library or a process, through a contract its documents write down; none keeps a copy.
2. **A component says why it exists.** Its `docs/00-context/vision.md` holds its philosophy: the problem it
   solves, for whom, and what it leaves out on purpose. Its requirements are a spec and its structural decisions
   ADRs, written before or with the code, never after.
3. **Within a tool, the same**: one module per concern (its settings, its texts, its process, its page), so a
   concern can leave the tool the day a second one needs it.

## Options considered
1. Keep features where they were born and copy them when another tool needs them: two behaviours, two sets of bugs.
2. One shared folder of helpers: no owner, no documents, no contract.
3. Components with their own project and contract.

## Consequences
- Positive: a tool is small and reads its components' contracts; a component is changed in one place and tested
  alone; the knowledge base has one row per thing.
- Negative: a new component costs its documents and its contract before its first line of code.

## References
- The first one: ADR-platform-0008 (`nuclear-chat`).
- The documents' standard: [docs/README.md](../README.md); rule 7 of the root `AGENTS.md`.
