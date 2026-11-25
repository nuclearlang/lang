---
status: approved
owner: Julian Molina
updated: 2026-11-25
related: [requirements.md, design.md, ../../03-adr/0004-every-database-is-a-plugin.md]
---
# 005 — Database adapters: tasks

Each phase ends with every test set green (root rule 16) and its documents in the same change.

## T0 — Decide

- [x] The inventory of what the repositories give (requirements §1).
- [x] CamusDB probed against the contract (design §5).
- [x] The user's decisions: every database is a plugin, native or adapted; the library retries (ADR-backend-0004).

## T1 — What Nuclear lacks (design §6)

- [ ] The kind `plugin` in `platform.toml`, `@refuses` and `@retries`, the loader's check of `@refuses` against a
      project's entities and its diagnostic.
- [ ] A plugin package (`plugin.toml`, the `.nuc`, the dialect parts) found by `nuclear add` and the installer.
- [ ] An HTTP client in the language's library, every language dialect, its conformance tests.
- [ ] Built Nuclear inside a runtime package: how it is built, shipped by the installer and typed.
- [ ] The entity metadata the templates write for an adapted connection.

## T2 — The four databases of today as native plugins

- [ ] `sqlite`, `postgres`, `mysql`, `mariadb` moved out of the dialects into plugin packages; `refusal` of each;
      the database check unchanged and green.
- [ ] `@transactional` retries on a `retry` refusal, both runtimes; an event inside a transaction sent at its
      commit; the same test in both.

## T3 — The Synapsis ORM in Nuclear

- [ ] Mapper, unit of work, entity states, the query as a SQL tree, the loader, the guards of a write, the retry.
- [ ] `SqlDialect` with the standard SQL; every row of requirements §1 tested through the SQLite plugin run adapted.
- [ ] Migrations: the diff, the history table, `make`/`up`/`down`/`status`, rendered by `schemaChange`.

## T4 — CamusDB, adapted

- [ ] The package `camusdb`: the adapter in Nuclear, `@refuses`, `@retries`, its docs; the rows of design §5 still
      to probe.
- [ ] `store_api` on CamusDB in `checks/database-check` with both dialects: the same answers as the four others;
      its `onDelete = "cascade"` gives the new diagnostic.
- [ ] `app-check`'s statement count on CamusDB no higher than on the native databases.

## T5 — A native plugin an agent writes

- [ ] SQL Server (or Oracle) written as a native plugin by an agent from a fresh install, following the playbook
      alone: the proof the knowledge base is enough.

## T6 — Deploy

- [ ] The reference (§2.8, Plugins), `diagnostics.md`, the brief, the guide.
- [ ] The knowledge base: `playbook:write-a-database-plugin` (the contract, native or adapted, the checks to pass),
      `can:` and `limit:` rows current; built, checked, ingested.
- [ ] The MCP tool that makes a plugin's skeleton; `uv tool install --reinstall tools/mcp`; `installer/install.sh`.
