---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [004-backend-parity/plan.md, ../01-product/roadmap.md]
---
# Specs of the backend platform

One folder per change being built: `NNN-name/`. Life cycle: `draft → approved → in-progress → done`. A feature of
this platform is written once in Nuclear and delivered in every dialect: its spec says what the reference gets, and
it is done when both checks run it. A change that touches several projects is in the tree's root
(`docs/04-specs/`).

| Spec | What | Status |
|---|---|---|
| [004-backend-parity](004-backend-parity/plan.md) | What a real API needs that the platform lacked: relations, migrations, transactions, pagination, authentication and guards, scheduled work, uploads, deploy and operations, the command at parity with mobile | in-progress: F1–F4 done ([ADR-backend-0001](../03-adr/0001-backend-data.md)); F5–F9 left (F9 belongs to the command line tools); one decision open for the user (§5) |
