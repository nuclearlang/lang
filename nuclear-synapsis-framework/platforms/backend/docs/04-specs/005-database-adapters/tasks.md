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

- [x] The kind `plugin` in `platform.toml`, `@refuses` and `@retries`, the check of `@refuses` against a project's
      decorators (N0313; `[decorators.refusals]`, no name in Rust) (2026-11-25). A plugin's refusals hold for the
      whole project, also for an entity on another connection.
- [x] A plugin package (`kind.toml`, the `.nuc` source, the dialect parts with `[plugin] values`) found next to
      the platform's contract, in a project's `kinds/` or the installation's, its source built with each project
      that enables it, its templates reading `package.<key>` (ADR-platform-0017) (2026-11-25).
- [ ] An HTTP client in the language's library, every language dialect, its conformance tests.
- [ ] Built Nuclear inside a runtime package (ADR-platform-0017): the runtime's build transpiles it, the installer
      ships it, its type definitions are regenerated.
- [ ] The entity metadata the templates write for an adapted connection.

## T2 — The four databases of today as native plugins

- [x] `sqlite`, `postgres`, `mysql` and `mariadb` moved out of the dialects and the runtimes into `plugins/`
      (2026-11-25); the runtimes' own tests use a `Database` of SQLite in memory.
- [ ] A native plugin of a new database (SQL Server, Oracle) also brings the rules the runtimes keep today by the
      ORM's dialect name (the text types, `ilike`, the catalog of the migrations): they become what its plugin gives.
- [x] `@transactional` retries a serialization failure or a deadlock (`RETRIES` = 3), both runtimes; an event
      inside a transaction sent at its commit; the same test in both (2026-11-25). A plugin's `@retries` sets it.

## T3 — The Synapsis ORM in Nuclear

- [ ] Mapper, unit of work, entity states, the query as a SQL tree, the loader, the guards of a write, the retry.
- [ ] `SqlDialect` with the standard SQL; every row of requirements §1 tested through the SQLite plugin run adapted.
- [ ] Migrations for every database (ADR-backend-0005): the kind `migration` and its changes, `migrate make` writing
      it from the kept schema, `up`/`down`/`status`/`--to`/`--fake`/`--transaction` through `schemaChange`,
      `rebuild` and `transactionalDdl`; the four databases of today on it, `checks/database-check/migrations.py`
      green; Alembic and the `nestjs` migrator removed.
- [ ] `nuclear upgrade` converts the migrations of before (Alembic, `nestjs`'s), their history kept, with fixtures
      of both.

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
