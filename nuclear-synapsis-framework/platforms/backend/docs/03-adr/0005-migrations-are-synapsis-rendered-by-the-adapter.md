---
status: accepted
date: 2026-11-26
deciders: Julian Molina
---
# ADR-0005: A migration is Nuclear, one format for every database and dialect, its DDL written by the database's adapter

## Context and problem

Since ADR-backend-0001 a migration is a file of the dialect's tool: an Alembic script in `fastapi`, a file over
Sequelize's `queryInterface` in `nestjs`. Both run only on a database their ORM knows, so a database adapted by the
Synapsis ORM (CamusDB, ADR-backend-0004) could not run them, and a project's migrations change with its dialect.
The user decided on 2026-11-26 that the adapter of a database also serves its migrations, with one Synapsis format
for every database ("un formato Synapsis para todas").

## Decision

**A migration is a `.nuc` file of the kind `migration`**, under `migrations/` of the project, written by `nuclear
migrate make` and the project's to edit: a list of changes of the schema, the same in every dialect and for every
database.

```nuclear
migration AddDoneToTasks
  up()
    addColumn("tasks", column("done", "boolean", default = false))
    addUnique("tasks", "tasks_title_key", ["title"])
  down()
    dropUnique("tasks", "tasks_title_key")
    dropColumn("tasks", "done")
```

**The changes are the platform's**: create, drop and rename a table; add, drop, rename and change a column (type,
length, null, default); add and drop a unique and a foreign key, each with its name; and `sql(text)` for what has no
change of its own (a backfill). `make` keeps the schema each migration leaves, so the next one is a difference of
two schemas and never reads a live database.

**The database's adapter writes the DDL** when a migration runs (`up`, `down`, `--to`, `--fake`, `status`): its
`schemaChange` turns a change into its statements, or into a rebuild of the table when the database cannot alter it
(SQLite, CamusDB), and its `transactionalDdl` says whether `--transaction all` holds (MySQL, MariaDB and CamusDB
commit each statement). The rules a user sees stay TypeORM's (ADR-backend-0002): the history table, the order, a
transaction per migration, the names of the constraints.

**Every database takes this way**, native or adapted: the four of today too. Alembic and the runtime's own
migrator of `nestjs` leave; a migration written by them before this decision is converted to the new form when the
project is upgraded, and its history is kept.

## Options considered

1. **One Synapsis format in Nuclear, the DDL written by the adapter** — chosen.
2. **Two formats**: the dialects' tools for the native databases, the Synapsis format for the adapted ones. Less to
   change now, but a project's migrations would depend on its database.
3. **One format as data (JSON)**: read by the runtimes with no build, but outside the language: no editor, no
   diagnostics, against root rule 9.

## Consequences

- Positive: a project keeps its migrations when it changes its dialect or its database; both dialects run the same
  file, so the database check compares the same changes.
- Positive: a new database brings its migrations in its plugin, and the plugin's check proves them.
- Negative: the platform owns the DDL of every database it supports, which Alembic and `queryInterface` gave before.
- Negative: the migrations of the existing projects are converted, with a test of the conversion.

## References

- Supersedes the migration part of ADR-backend-0001 (the dialect's tool, `[toolchain]` `migrate_make`); keeps
  ADR-backend-0002 (TypeORM's behaviour). Builds on ADR-backend-0004 (every database is a plugin).
- Spec: [005-database-adapters](../04-specs/005-database-adapters/design.md).
