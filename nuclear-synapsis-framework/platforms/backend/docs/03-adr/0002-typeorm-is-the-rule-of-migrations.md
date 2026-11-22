---
status: accepted
date: 2026-11-22
deciders: Julian Molina
---
# ADR-0002: TypeORM is the rule of behaviour for migrations

## Context and problem

Each backend dialect runs its migrations with the tool of its target (ADR-backend-0001): Alembic in `fastapi`, the
runtime's own differ over Sequelize in `nestjs`. Version 0.91 gave them the same commands, messages and exit codes,
and left open what the two tools did differently and what nobody had decided: the shape of the history, a pending
migration older than an applied one, a migration missing from the folder, a database that already has its tables,
how much one transaction holds, the schema of `@created` / `@updated`, the rule of a foreign key nobody wrote, the
names of the types. Each one needed a rule, and a rule made up per case would be a third behaviour to learn.

## Decision

The user's words (2026-11-22): "en cuanto a las inconsistencias de las migraciones [...] toma como referencia como lo
haga typeorm y hazlo así para todos los demás, toma a typeorm como regla de comportamiento".

**Where the dialects differ, or a behaviour is undecided, the migrations of every dialect do what TypeORM's do.**
Checked against TypeORM 1.1.3 (`migration/MigrationExecutor`, its drivers and its commands). What was adopted:

| Behaviour | TypeORM | Every dialect now |
|---|---|---|
| The history | a table `migrations`: `id` (generated), `timestamp`, `name`; one row per migration executed | the same table and columns; `timestamp` is the 14 digits of the migration's name |
| The order | by the timestamp of each migration; no parent, no branch | by the timestamp in the file's name; a migration has no required parent |
| A pending migration older than an applied one | it runs (the check that refused it is commented out in the executor) | it runs, in the order of the timestamps of the pending ones |
| A migration applied and missing from the folder | `run` and `show` do not look at it; `revert` of that one fails ("No migration ... was found in the source code") | the same: only its revert is refused |
| Which one `revert` takes | the last one executed (the highest `id`), whatever its timestamp | the same (`nuclear migrate down`) |
| `revert` with nothing applied | says so, ends well | the same |
| A migration edited after it ran | not noticed | not noticed |
| A database that already has its tables | `migration:run --fake`, `migration:revert --fake`: the history changes, nothing runs | `nuclear migrate up --fake`, `nuclear migrate down --fake` |
| Transactions | `--transaction all \| each \| none`, default `all`: every pending migration in one transaction | the same option and default |
| The list | `migration:show`: every migration of the source, `[X]` or `[ ]` | `nuclear migrate status` (the command keeps Nuclear's name and words): every migration of the folder, `applied` or `pending` |
| `@created`, `@updated` | `NOT NULL` with the database's clock as default | the same: `NOT NULL DEFAULT (CURRENT_TIMESTAMP)`; the app still writes them |
| The fraction of a date column on MySQL and MariaDB | `datetime(6)` for the date columns it gives a fraction (`createDatePrecision`, `updateDatePrecision`: 6 in `MysqlDriver`); a plain date column has none (`datetime`, precision 0) | `DATETIME(6)` for every `DateTime` column, the timestamps too (the user, 2026-11-22: a `DateTime` keeps its fraction); SQLite names it the same |
| A foreign key without a rule | `ON DELETE NO ACTION ON UPDATE NO ACTION` | the same; `onDelete` of the relation is the only rule written |
| The names of the types on SQLite | `boolean`, `double` | `BOOLEAN`, `DOUBLE` |
| A constraint that goes | by the name it has in the database, which TypeORM reads there | found in the database by its column when its name is not the expected one |

**What we do not have because TypeORM does not**, as a decision and not as pending work: a checksum of the applied
files, a lock against two runs at once, a rename found by `make`, seeds, one migration made from many, a baseline
other than `--fake`.

**Where we knowingly differ from TypeORM:**

1. *`make` compares the entities with the migrations, never with a database* (ADR-backend-0001), where
   `migration:generate` compares with the database. `make` needs no running database and the same file runs on
   every database. Because of it each dialect brings two migrations made at the same time together by itself (one
   runs every migration on an empty database, the other keeps in each file the migrations it was made after).
2. *A changed key is refused by `make`*, where `migration:generate` writes the change of the primary key. Neither
   tool underneath can write it for the four databases (a generated key, the foreign keys that point to it), so
   both dialects refuse with the same message instead of writing nothing.
3. *`@updated` has no `ON UPDATE CURRENT_TIMESTAMP`* on MySQL and MariaDB, which TypeORM writes there. It is a
   clause of one database: the migration file would no longer be the same for every database. The app writes the
   column with every change, in every dialect.
4. *`nuclear migrate --to <migration>`* (up and down) has no equivalent in TypeORM; it stays, with TypeORM's order:
   up to that timestamp, back to that row of the history.
5. *The clock of a timestamp is `(CURRENT_TIMESTAMP)`*, where TypeORM writes `CURRENT_TIMESTAMP(6)` on MySQL.
   `CURRENT_TIMESTAMP(6)` is not SQLite's, and MySQL refuses a plain `CURRENT_TIMESTAMP` as the default of a
   `DATETIME(6)`; in parentheses the four databases take it, so the migration file stays the same for all of them.
   On SQLite and MySQL that clock gives whole seconds.
6. *A failed migration says what is left* (nothing, or what MySQL and MariaDB cannot undo), where TypeORM prints the
   database's error.

A database migrated by 0.91 or 0.92 keeps working: the first command reads the history its tool kept
(`alembic_version`, `SequelizeMeta`), writes `migrations` from it and leaves the old table as it was.

## Options considered

1. **TypeORM as the rule** — chosen: one known tool decides every open case, the entities already read like its.
2. **A rule per case, the strictest of the reference tools** (Flyway's checksums and refusals): more to build and to
   learn, and a behaviour of our own.
3. **Each dialect as its tool behaves**: the same Nuclear project would migrate differently by dialect, against
   the platform's rule 2.

## Consequences

- Positive: `status`, `up`, `down` and their refusals read the same facts in every dialect; the schemas the dialects
  leave are the same on each database, and the database check fails on any difference.
- Positive: a database made by `createTables` comes under migrations with `--fake`: since 0.94 each runtime makes
  those tables with what its first migration runs, and the database check holds the two schemas equal.
- Negative: an older pending migration runs after newer ones, as in TypeORM: it must not depend on being first.
- Negative: with `--transaction all` on MySQL and MariaDB a failure leaves the migrations before it applied (they
  commit every schema change); the message says so.
- Negative: `fastapi` no longer uses Alembic's revisions: its files run only through `nuclear migrate`.

## References

- Amends: ADR-backend-0001 (the migrations' history and rules; its generation rule stays).
- The rules for a user: [the reference](../07-reference/backend.md) §2.8.
- How the runtimes build it: [Python](../02-architecture/runtime-python.md#migrations),
  [TypeScript](../02-architecture/runtime-typescript.md#migrations).
