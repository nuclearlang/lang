---
status: draft
owner: Julian Molina
updated: 2026-11-25
related: [requirements.md, design.md]
---
# 005 — Database adapters: tasks

Each phase ends with every test set green (root rule 16) and its documents in the same change.

## T0 — Decide

- [x] The inventory of what the repositories give (requirements §1).
- [x] CamusDB probed against the contract (design §4).
- [ ] The user's two decisions (design §5), then the ADR (`ADR-backend-0004`) and this spec `approved`.

## T1 — What Nuclear lacks (design §6)

- [ ] An HTTP client in the language's library, every language dialect, its conformance tests.
- [ ] Built Nuclear inside a runtime package: how it is built, shipped by the installer and typed.
- [ ] A kind package with `[adapter]`: the connection word, `refuses`, the loader's check and its diagnostic.
- [ ] The entity metadata the templates write for an adapted connection.

## T2 — The Synapsis ORM in Nuclear

- [ ] Mapper, unit of work, entity states, the query as a SQL tree, the loader, the guards of a write.
- [ ] `SqlDialect` with the standard SQL, and the tests of each requirement row on SQLite through a test adapter.

## T3 — Migrations on an adapted connection

- [ ] The diff, the history table, `make`/`up`/`down`/`status`, rendered by `schemaChange`.

## T4 — CamusDB

- [ ] The package `camusdb`: the adapter in Nuclear, `[adapter]`, its docs; the rows of design §4 still to probe.
- [ ] `store_api` on CamusDB in `checks/database-check` with both dialects: the same answers as the four others;
      its entities' `onDelete = "cascade"` gives the new diagnostic.
- [ ] `app-check`'s statement count on CamusDB no higher than on the ORM databases.

## T5 — Deploy

- [ ] The reference (§2.8, Plugins), `diagnostics.md`, the brief, the guide for an agent that adapts a database,
      the MCP tool and the knowledge base, `installer/install.sh` (root rule 15).
