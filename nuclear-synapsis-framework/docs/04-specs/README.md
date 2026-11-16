---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../01-product/roadmap.md, ../03-adr/README.md]
---
# Specs

One folder per change of the framework as a whole: `NNN-name/`. Life cycle: `draft → approved → in-progress →
done`. A change of one platform starts in that platform's `docs/04-specs/`; one that changes several projects of
the tree starts in the root `docs/04-specs/`.

| Spec | Change | Status | Decision | Owner |
|---|---|---|---|---|
| [003-shared-contracts](003-shared-contracts/plan.md) | A backend written once, its clients generated from its contract | in-progress: F1–F4 delivered; left: the drift warning of F5 and the aliases in the `nuclear` command ([roadmap](../01-product/roadmap.md)) | ADR-synapsis-0006 | Julian Molina |

Spec 003 is one file, `plan.md`: goal, diagnosis, design, features F1–F5 and work order.
