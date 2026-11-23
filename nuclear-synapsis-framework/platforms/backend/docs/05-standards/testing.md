---
status: accepted
owner: Julian Molina
updated: 2026-11-22
related: [../06-runbooks/change-a-runtime.md, ../02-architecture/overview.md, ../../../docs/05-standards/testing.md]
---
# Testing

The tests every platform shares (the contract, the layout, the generators, what a golden and a conformance example
are) are in [testing a platform](../../../docs/05-standards/testing.md). Here: what this platform adds.

## What is tested at each level

| Level | What it covers | Run by |
|---|---|---|
| The compiler's tests | Every example built and compared with its golden: `examples/expected/rick_api/`, `examples/expected/tasks_api/`, `examples/expected/store_api/` (`nuclearlang/crates/nuclear-transpile/tests/projects.rs`), `examples/examples-nestjs/users.ts` (`golden.rs`); conformance: `tasks_api` built with `nestjs` and `fastapi` (`backend_example_builds_with_every_backend_dialect`); `tasks_api` also as the backend of the mobile `tasks_app` | `cargo test` at the root of the tree |
| The runtimes' tests | `packages/synapsis-py/tests/` (pytest), `packages/synapsis-nest/test/` (`node:test`) | the two checks |
| The fastapi check | `rick_api` built; pyright `--strict` and the project's own tests on the generated code; a live run; then the conformance example | `checks/fastapi-check/check.sh` |
| The nestjs check | the runtime built; `tasks_api` built; `tsc --strict` and the project's own tests; a live run; the migrations | `checks/nestjs-check/check.sh` |
| The database check | `store_api` built with each dialect for SQLite, PostgreSQL, MySQL and MariaDB (real servers in Docker): the strict checker, every kind of migration with `nuclear migrate` against the real database, one HTTP scenario, the project's tests, the tables `createTables` makes against the first migration's; the answers compared between dialects and databases, the schemas' differences listed; a project made with `nuclear new` migrated | `checks/database-check/check.sh` |
| The references' equivalences | each dialect's reference against the real output (the dialects' projects own them) | `nuclearlang/tools/spec-check/check.py` |

## Set up, once

From the root of the tree:

```sh
(cd nuclearlang/tools/node && npm install)
python3 -m venv nuclearlang/tools/python/.venv
nuclearlang/tools/python/.venv/bin/pip install -r nuclearlang/tools/python/requirements.txt
nuclearlang/tools/python/.venv/bin/pip install -e nuclear-synapsis-framework/platforms/backend/packages/synapsis-py --config-settings editable_mode=compat
(cd nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest && npm install)
```

## Running the checks

```sh
cargo test
sh nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh
sh nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh
sh nuclear-synapsis-framework/platforms/backend/checks/database-check/check.sh   # needs Docker
```

The first two scripts find the tree from their own place (`NUCLEAR_ROOT` overrides it), build with
`cargo run -p nuclear-cli -- build` and stop at the first failure, printing the failed command's whole output.

**`fastapi-check/check.sh`**, in order:

1. Builds `examples/examples-fastapi/rick_api` into its `build/`.
2. pyright over the generated project, then its tests (pytest: the project's `test/*_test.nuc`).
3. `smoke.py`: the REST API over an in-memory database (201, 409, 400, 404, the list), the agent with its tools and
   the graph with a fake chat model (no network), and `/openapi.json`.
4. The runtime's tests: `packages/synapsis-py/tests`.
5. **Conformance**: copies `examples/examples-backend/tasks_api` (written for `nestjs`), switches its `config.nuc`
   to `dialect = "fastapi"`, builds it, runs pyright and its tests.
6. **Migrations**: on that copy, with `DATABASE` set to a fresh SQLite file, `synapsis.migrate make "first"`,
   `up`, then `make "again"` must answer "no changes".

**`nestjs-check/check.sh`**, in order:

1. Builds the runtime with `tsc` and copies it fresh into `nuclearlang/tools/node/node_modules`
   (`npm install --no-save --install-links`). npm keeps an old copy of the same version, so the script removes it
   first; a `--no-save` install also prunes the other runtime installed the same way, so the web platform's check
   installs its own again.
2. Builds `examples/examples-backend/tasks_api` and links `node_modules` into its `build/`.
3. `tsc --strict`, then the project's tests (`node --test "dist/test/**/*.js"`).
4. `smoke.mjs`: the REST CRUD over SQLite in memory (`SYNAPSIS_DATABASE=memory`), validation (400 with two
   messages), the errors of a `Result` (409, 404).
5. **Migrations**: with `DATABASE` set to a fresh SQLite file, `migrate make "first"`, `up`, then `make "again"`
   must answer "no changes".
6. The runtime's tests (`tsconfig.test.json`, `dist-test/test/**/*.js`).

**`database-check/check.sh`** (needs Docker running, besides the set-up above; about twenty minutes). It proves that
one Nuclear project behaves the same in every dialect on every database. `check.sh fastapi postgres` runs only those
dialects and databases (any of `fastapi`, `nestjs`; any of `sqlite`, `postgres`, `mysql`, `mariadb`). It prints one
`ok` / `FAIL` line per dialect, database and stage, goes on after a failure and exits 1 if any failed.

1. Starts `postgres:16-alpine`, `mysql:8.0` and `mariadb:11` one at a time, each in a throwaway container
   (`nuclear-dbcheck-<pid>-<database>`, a free port of `127.0.0.1`, its data in memory), waits for its health check,
   and removes it when done; a `trap` removes them all however the script ends. SQLite is a file.
2. For each dialect and database: copies `examples/examples-backend/store_api` to a temporary folder (`TMPDIR`;
   `KEEP=1` keeps it) and changes only the dialect, the plugin and the connection (`Postgres(url =
   env("DATABASE_URL"))`..., without `createTables`), in an empty database of its own (`store_<dialect>`). Then, the
   stages:
   - **build**, **checker**: `nuclear build`, then pyright or `tsc --strict`.
   - **new** (SQLite only, once per dialect): a project made with `nuclear new` and `nuclear gen resource`, then
     `nuclear migrate status`, `make`, `up`, `make` (no changes), `status`, `down`, `status`.
   - **migrations** (`migrations.py`): every step runs the real command, `nuclear migrate`, of the tree's build
     (`target/debug` is first on `PATH`; the project's `build/` gets the shared tools as `.venv` or
     `node_modules`, in place of `nuclear install`). After each step `db.py` reads the real schema back (tables,
     columns, type, length, null, the default by its meaning, the key, the unique columns, the foreign keys and
     their `ON DELETE`) and the rows. A `down` must leave exactly the schema read before its `up`. One line per
     scenario is printed under the stage (`+`):
     1. `make`, `up`, nothing left to make, `status`, `down` to an empty database, `down` with nothing applied.
     2. The tables are there and the history is empty: `up` is refused whole; `up --fake` and `down --fake` change
        the history only.
     3. A column with a default added to a table with rows (`points: int = 7`); the rows were inserted by SQL
        without `created_at` / `updated_at` (their default).
     4. A column's type, null, default and length changed, a unique added.
     5. A table, a foreign key on a table with rows (`@manyToOne`) and a join table (`@manyToMany`).
     6. A table and two columns renamed: without `--rename`, `make` writes a drop and an add and warns (the warning
        says the option); nine renames that are not there are refused with the same words; with `--rename
        shops=stores --rename shops.name=title --rename orders.shop_id=store_id` it writes the renames only: the
        rows and the foreign key follow, `down` renames back.
     7. A column, a unique and a foreign key dropped (its column stays); the unique first renamed in the database
        to the name a database gives one made without a name.
     8. A failing migration after a good one, with `--transaction all` (PostgreSQL and SQLite keep neither), `each`
        (the good one stays) and `none` (what the failed one did stays); MySQL and MariaDB keep what ran and the
        message says so; fixed, it applies.
     9. A pending migration older than the applied ones (applied, and reverted first by `down`); a migration
        missing from the folder (only its revert is refused).
     10. The history as 0.91 / 0.92 kept it (`alembic_version`, `SequelizeMeta`) converted in place.
     11. `down --to` the first migration (the first schema again, the rows kept), `up --to` the second, `up`.
     12. The entities of step 3 again: one migration drops everything added since; the app of the next stage runs
         on that schema.
     13. A text longer than a `VARCHAR` holds: the note of an order made 100000 characters long (`MEDIUMTEXT` on
         MySQL and MariaDB, `VARCHAR(100000)` on the others), then 5000000 (`LONGTEXT`), a text of 100000
         characters kept through `up` and `down`, then 2000 again: the schema of step 3.
   - **integration**: the built app started on that database and driven by `scenario.py`, the same requests for
     every dialect and database: CRUD, defaults, the unique email (409), invalid bodies (400), missing rows (404),
     pages, search in any case, filters and order, unicode and emoji, a text of 2000 characters, the limits of an
     `int`, decimals, booleans, null against an empty text, timestamps with a time zone, the milliseconds of a
     `DateTime` written and read back, a value of another JSON type refused for each type (and `30.0` taken as a
     whole number, a number of the query converted), a model built in code that breaks its rule (500), the relations loaded and
     not loaded, the tags of an order replaced, two `@transactional` use cases whose `Err` comes after a write
     (checked with SQL: nothing was kept), 32 concurrent writes and reads, 16 concurrent requests for one unique
     value (one row, one 201 and fifteen 409, never a 500), what the database refuses for integrity (the coupons,
     whose use cases check nothing: a repeated unique value, the same value twice in one transaction, a foreign
     key that points at nothing, a null in a required column, a row others point to, a text longer than its
     column: each 409 `conflict`, the transaction rolled back, a text of the column's length in characters
     kept), the cascade of a delete.
   - **tests**: the project's `test/*_test.nuc` with the dialect's runner (their database is in memory).
   - **tables** (`tables.py`): the same project built with `createTables = true` on an empty database of its own
     (`made_<dialect>`) and the note of an order 100000 characters long (the text type of each database); the app
     is started once, so it makes the tables. Their schema, with the names of the
     uniques and foreign keys, is written as step 0 for the comparison between the dialects. Then, with
     `nuclear migrate`: `make`, `up` refused (the tables are there), `up --fake`, nothing left to make, `down`
     (the tables go), `up`: the schema must be the one `createTables` made, names included. Last, the first
     migration is written as 0.93 wrote it (a `DateTime` without its fraction; the lines in the dialect's
     migration language) and applied, and rows are written by SQL; the next `make` must write the change, and
     `up` must give the schema `createTables` made with the rows kept and a fraction written by SQL kept too;
     `down` and `up` again.
3. **schemas**: `db.py compare` compares the schemas the two dialects left on the same database after each step,
   and the one `createTables` left (step 0, with the names of the constraints)
   (columns, the type as the database names it, null, default, key, unique, foreign keys with `ON DELETE` and
   `ON UPDATE`). Any difference is a failure (`~` lines): ADR-backend-0002.
4. **answers**: every answer of the scenario is written normalized (an id becomes the order its row was made in,
   `createdAt` / `updatedAt` their shape, `401.0` is `401`; the body of an error whole, with its reasons) and the files are
   compared byte by byte: the same in every dialect on every database.

What the scenario leaves out of the comparison because it differs by run, and says in its line: how many of the
losers of the race for a unique value answer 409 or 500 ([roadmap](../01-product/roadmap.md)). And one answer it
only reads: a model built in code that keeps its rules, whose optional field left empty is `null` in one dialect
and absent in the other (the roadmap).

## Conventions

- **One feature, both dialects.** A feature has a test in Nuclear in the example (`test/*_test.nuc`), which each
  dialect runs with its own runner; a behaviour of the runtimes has the same test in both
  (`packages/synapsis-py/tests/test_data.py`, `packages/synapsis-nest/test/data.test.ts`; the migrations:
  `tests/test_migrate.py`, `test/migrate.test.ts`).
- **Goldens.** When the generated output changes on purpose: `UPDATE_GOLDEN=1 cargo test`, then review the diff. An
  expected file the build no longer produces is a failure too.
- **No network, no real service** in the fastapi and nestjs checks: SQLite (in memory or a temporary file) and fake
  chat models (`FakeModel`). The database check is the one that runs real servers, in Docker, and nothing else
  outside this machine. What was never run against a real service is listed in the roadmaps (this one and each
  dialect's).
- **A difference between the dialects or between the databases is a bug of a runtime or of a dialect**, fixed there
  with the same test in both runtimes; the scenario is never bent to hide it. What cannot be the same is said in the
  roadmap and in the scenario's line.
- **The tests of a project start from an empty database**: in memory, empty in each test.

## CI

`.github/workflows/platform-backend.yml`, on a change to `nuclearlang/**`, `tools/cli/**`, the Cargo files or this
folder: Node 26 and Python 3.14; `npm ci` in `nuclearlang/tools/node` and `installer/release/build-runtimes.sh`;
the Python tools and the runtime; the equivalences of the `fastapi` and `nestjs` references; then the fastapi and
nestjs checks. The database check is not in the CI yet ([roadmap](../01-product/roadmap.md)).
