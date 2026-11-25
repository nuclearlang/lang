# The backend platform

The backend platform of Synapsis: HTTP APIs, databases with relations, migrations and transactions, events, AI
agents and graphs, written once in Nuclear and built with any of its dialects. This folder holds what is the same
for every dialect: the contract (`platform.toml`), the runtime packages the generated code runs on, the examples
and the checks. The Nuclear of a backend project never changes when its dialect changes.

Paths in these documents are relative to this folder (`nuclear-synapsis-framework/platforms/backend/`); a path that
starts with `nuclearlang/`, `nuclear-synapsis-framework/`, `tools/`, `installer/` or `.github/` starts at the root
of the tree. The rules of the whole platform are in [the root `AGENTS.md`](../../../AGENTS.md).

## Stack

- The contract: `platform.toml`, TOML read by the compiler's loader (`nuclearlang/crates/nuclear-dialect`).
- The dialects that implement it, each documented by its language's dialect project:
  - `fastapi` (Python 3.12+): FastAPI, SQLAlchemy 2 async, pydantic, Alembic, LangChain / LangGraph, pytest.
  - `nestjs` (TypeScript, ES modules): NestJS 12, sequelize-typescript, class-validator, LangChain.js /
    LangGraph.js, `node:test`.
- The runtimes: `packages/synapsis-py` (Python, imported as `synapsis`, setuptools) and
  `packages/synapsis-nest` (npm, ESM, TypeScript 5.9).
- The checks: `sh` scripts over `nuclearlang/tools/python/.venv` (pyright, pytest) and `nuclearlang/tools/node`
  (tsc, `node:test`). CI: `.github/workflows/platform-backend.yml`.

## Commands

From the root of the tree:

```sh
# once
(cd nuclearlang/tools/node && npm install)                     # the shared Node tools of the checks
python3 -m venv nuclearlang/tools/python/.venv
nuclearlang/tools/python/.venv/bin/pip install -r nuclearlang/tools/python/requirements.txt
nuclearlang/tools/python/.venv/bin/pip install -e nuclear-synapsis-framework/platforms/backend/packages/synapsis-py --config-settings editable_mode=compat
(cd nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest && npm install)

# before a change is done
cargo test                                   # the examples with both dialects, the goldens
sh nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh   # pyright --strict, pytest, migrations, a live run
sh nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh    # tsc --strict, node:test, migrations, a live run
sh nuclear-synapsis-framework/platforms/backend/checks/database-check/check.sh --parallel  # needs Docker: both dialects on PostgreSQL, MySQL, MariaDB, SQLite, every pair at once
sh nuclear-synapsis-framework/platforms/backend/checks/app-check/check.sh       # needs Docker: the logs, the security and the performance of an app in both dialects
UPDATE_GOLDEN=1 cargo test                   # the generated output changed on purpose: regenerate, review the diff
installer/install.sh                         # the user runs the installed copy: install after a change
```

## Folders

- `platform.toml`: the contract: kinds, decorators, plugins, the rules of the data decorators, `[layout]`. What
  `nuclear make` and `gen` write (`[skeletons]`, `[gen]`, `[[generators.*]]`) is
  `tools/code_generator/platforms/backend/generators.toml`.
- `plugins/<database>/`: the databases as plugin packages (ADR-backend-0004): `kind.toml`, the `plugin` in Nuclear,
  a folder per dialect with `[plugin]` (`packages`, `names`, `values`). The loader finds them next to
  `platform.toml`; the installer copies them there. Only `postgres` is one yet (spec 005).
- `packages/synapsis-py/`: the runtime of the Python dialect (`src/synapsis/`, `tests/`).
- `packages/synapsis-nest/`: the runtime of the TypeScript dialect (`src/`, `test/`).
- `examples/examples-backend/tasks_api/`: the conformance example, built with every dialect.
- `examples/examples-backend/store_api/`: the example of the database check (customers, orders, tags, coupons: relations,
  pages, searches, transactions, what the database refuses), made with `nuclear new` and `nuclear gen`.
- `examples/examples-fastapi/rick_api/`: the example of the fastapi check.
- `examples/examples-nestjs/users.nuc`, `users.ts`: a one-file golden.
- `examples/onboarding/todos_api/`: the app of the onboarding, made only by `nuclear new` and `nuclear gen` (the
  website runs those commands again and fails if they do not give it).
- `examples/expected/{rick_api,store_api,tasks_api,todos_api}/`: the golden output of the projects.
- `checks/fastapi-check/`, `checks/nestjs-check/`: `check.sh` and the live runs (`smoke.py`, `smoke_tasks.py`: the
  guards and the WebSocket of `tasks_api`; `smoke.mjs`).
- `checks/database-check/`: `check.sh` (every dialect × every database, in Docker), `db.py` (the real schema, the
  seed, SQL), `migrations.py` (every kind of schema change with `nuclear migrate`, a rename with `make --rename`, a long text), `tables.py` (the tables
  `createTables` makes against the first migration's) and `scenario.py` (the one HTTP
  scenario whose answers are compared).
- `checks/app-check/`: `check.sh` (an app of each dialect run as a user runs it), `logs.py` (every line it prints
  against an allow-list), `security.py` (the same hostile requests to both dialects), `audit.py` (the advisories of
  the dependencies), `performance.py` and `load.mjs` (the same load, the SQL statements of a request), `probes/`
  (the Nuclear of the probe routes), `known.txt` and `known.py` (the findings not fixed yet).
- `docs/`: this project's documents (the table below). `CHANGELOG.md`: what changed for a user.

Outside this folder: the dialects (`nuclearlang/dialects/python/frameworks/fastapi/`,
`nuclearlang/dialects/typescript/frameworks/nestjs/`) and the type definitions of the runtimes
(`nuclearlang/dialects/python/defs/synapsis/`, `nuclearlang/dialects/typescript/defs/synapsis-nest/`).

## Rules

1. **The platform names no dialect.** `docs/07-reference/backend.md`, the brief, `platform.toml` and the `.nuc` of
   the examples hold only Nuclear and Nuclear's own library; a name of a target's library there is a bug. How a
   dialect writes a kind is in that dialect's reference, never here.
2. **Kinds and features never differ between the dialects.** A feature is written once in Nuclear and every dialect
   implements it: the platform's reference gets the Nuclear, each dialect's reference its output, both checks run
   it. `tasks_api` must keep building with every dialect.
3. **`platform.toml` is the contract.** A kind, a decorator or a plugin a dialect uses is listed there, or the
   loader refuses the dialect (N0305). The rules of a decorator are data there (`[decorators.args]`,
   `[decorators.fields]`): no decorator name is written in Rust.
4. **The runtimes behave the same.** A behaviour added to one is added to the other, with the same test in both
   (`packages/synapsis-py/tests/test_data.py`, `packages/synapsis-nest/test/data.test.ts`; the types of a body
   and a model built in code: `tests/test_types.py`, `test/types.test.ts`; the guards and the WebSocket:
   `tests/test_sockets.py`, `test/sockets.test.ts`). The database check compares their answers on every
   database: a change of the data words runs it.
5. **A changed public API of a runtime** means its type definitions are regenerated
   ([runbook](docs/06-runbooks/change-a-runtime.md)).
6. **The examples are goldens.** Output that changed on purpose: `UPDATE_GOLDEN=1 cargo test`, then review the diff.
7. **A file's name in `docs/07-reference/` and `docs/08-guides/` is its topic**: `nuclear help backend` and
   `nuclear spec --brief` find them by name, and the installer copies both folders with `platform.toml` and
   `packages/`. They are normative: changed only with the feature they describe.
8. Done = `cargo test`, `cargo clippy --all-targets` and both checks green, the reference and these documents
   updated in the same change, `docs/01-product/roadmap.md` current.

## Documents

| Read | When |
|---|---|
| [docs/00-context/vision.md](docs/00-context/vision.md) | You need what the platform is for, who uses it and what it does not do |
| [docs/00-context/glossary.md](docs/00-context/glossary.md) | A word has two meanings here (contract, component, runtime, plugin) |
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is half done, untested or pending in the platform and its runtimes |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You need the shape: how a project becomes a running app, each section of `platform.toml`, the dialects, the examples |
| [docs/02-architecture/runtime-python.md](docs/02-architecture/runtime-python.md) | You change `packages/synapsis-py` (modules, relations, transactions, migrations) |
| [docs/02-architecture/runtime-typescript.md](docs/02-architecture/runtime-typescript.md) | You change `packages/synapsis-nest` (entry points, relations, transactions, migrations, how it is installed) |
| [docs/02-architecture/dependencies.md](docs/02-architecture/dependencies.md) | You add or move a library of a runtime, or need who depends on this folder |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why the data words (`@primary`, relations, `paginate`, `@transactional`, migrations) are as they are |
| [docs/04-specs/README.md](docs/04-specs/README.md) | You continue backend parity (auth, jobs, uploads, deploy) |
| [docs/05-standards/testing.md](docs/05-standards/testing.md) | You run or change a check, a golden or a runtime test |
| [docs/06-runbooks/change-a-runtime.md](docs/06-runbooks/change-a-runtime.md) | You changed a runtime and need the steps after it |
| [docs/07-reference/backend.md](docs/07-reference/backend.md) | You need the rules of the platform: the project, every kind, the plugins (`nuclear help backend`) |
| [docs/07-reference/brief/backend.md](docs/07-reference/brief/backend.md) | You want the short sheet an agent reads before writing a backend |
| [docs/08-guides/contracts.md](docs/08-guides/contracts.md) | You connect an app to a backend through its contract |
| [docs/08-guides/onboarding-backend.md](docs/08-guides/onboarding-backend.md) | You need the first steps of a user: the todos API in four commands |

Elsewhere:

- How each dialect writes the platform: [the Python dialect](../../../nuclearlang/dialects/python/AGENTS.md)
  (`fastapi`: `docs/07-reference/fastapi.md`, `docs/08-guides/fastapi.md`) and
  [the TypeScript dialect](../../../nuclearlang/dialects/typescript/AGENTS.md) (`nestjs`:
  `docs/07-reference/nestjs.md`, `docs/08-guides/nestjs.md`).
- What the three platforms share (the format of `platform.toml`, what the loader checks, the common tests):
  [the platforms](../AGENTS.md). The philosophy: [the framework](../../AGENTS.md). The commands (`nuclear new`,
  `build`, `run`, `test`, `migrate`): [the command line tools](../../../tools/cli/AGENTS.md). `nuclear make` and
  `gen`: [the code generator](../../../tools/code_generator/AGENTS.md).
- The compiler, the loader and the format of a dialect and of a project: [the language](../../../nuclearlang/AGENTS.md).
