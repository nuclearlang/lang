---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0006: The Builder is a workbench: specs by component and layer, a general agent's chat

## Context and problem
After ADR-platform-0005 the Builder's page was one run at a time over a flat folder of specs (`specs/<id>/`). The
user wants it to work like an editor of its own (spec 011, requirements 19 to 21): several runs followed at once,
the specs found where the business is, and an agent to talk to that writes a spec's base, says what a run did and
explains it, worked by the provider the user chooses.

## Decision
1. **Specs by business component and layer.** A spec lives in `specs/<component>/[<layer>/]<id>/` (`component`: a
   folder of `components/`; `layer`: `presentation`, `domain` or `data`, only when the spec touches one;
   `_global` for the whole project). A run keeps its spec's path (`specPath`). The layout is by component by
   default; `nuclear-builder spec migrate` moves the flat specs of before. This amends ADR-platform-0005, which
   wrote `specs/<id>/`.
2. **The page is a workbench** (n8n as a base, not a copy): the specs' tree and the runs as an accordion on the
   left, the run's diagram in C4's four levels in the middle with the chat under it, the chosen node over the team
   and its log on the right. Every column folds and resizes; the editor remembers how.
3. **The chat is a process of the factory**, one per conversation (`nuclear-builder chat --events`), with its
   history in the project (`.nuclear/builder/chat/<id>.jsonl`). It is worked by any provider (local, agent or API,
   the setting `nuclear.builder.chat`), writes only through the factory's tools (`spec_new`, ...), never a role's
   files, and its spending is confirmed twice like a run's.

## Options considered
1. Keep the flat `specs/<id>/` and filter by a field of the spec: the folders would not say where the business is.
2. Folders by layer first: one feature would be split across three trees.
3. The chat inside the page's script calling the providers: a second engine in TypeScript, against Nuclear first.

## Consequences
- Positive: a spec is found by its component; several runs are followed at once; the chat reaches every provider
  through the same adapters and rules as a run.
- Negative: a project's specs of before must be moved (`spec migrate`); the JetBrains tool window does not have
  the workbench nor the chat yet; the factory's tools reach the providers as text until a factory MCP server exists.

## References
- Amends: ADR-platform-0005
- Spec: [011 — the software factory](../04-specs/011-software-factory/requirements.md), requirements 19 to 21
