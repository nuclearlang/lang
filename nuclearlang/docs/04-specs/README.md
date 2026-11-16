---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../01-product/roadmap.md, ../../../docs/README.md]
---
# Specs of the language

One folder per feature being built: `NNN-name/`. A feature that changes only this project starts here; one that
changes several projects starts in the tree's `../docs/04-specs/`. Life cycle:
`draft → approved → in-progress → done`. The rules a feature produces end up in `docs/07-reference/` and its
decisions in `docs/03-adr/`; a spec records how the work is split, not the final rules.

A new spec has `requirements.md`, `design.md` and `tasks.md`. The two specs below are each one `plan.md` instead:
the goal, the diagnosis, the features with their "done" criterion, the work order and the decisions pending for the
user. Spec numbers are shared with the tree's list (`../docs/04-specs/`), so they are not consecutive here.

| Spec | Feature | Status | What is left |
|---|---|---|---|
| [002-dialects-with-agents](002-dialects-with-agents/plan.md) | A coding agent creates a new dialect under written rules: `nuclear dialect test`, `nuclear dialect new`, a skill and `AGENTS.md`, a neutral spec per platform, `[toolchain]`, dialects installable from a repository, emitter capabilities per target (D1–D7) | approved | not started: it starts when the user asks |
| [005-language-1-0](005-language-1-0/plan.md) | The language to 1.0: the formatter (F1), TypeScript type definitions and member types (F2), named and factory constructors (F3), patterns everywhere (F4), `const` inference in Dart and a pattern `switch` (F5), the 1.0 freeze (F6) | in-progress | F1 is done (only reflow); F2–F6 not started; the constructor word is to decide with the user (§4 of the plan) |

The pending work as a list is in [the roadmap](../01-product/roadmap.md).
