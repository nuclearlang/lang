---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../06-runbooks/change-a-runtime.md, ../02-architecture/overview.md, ../../../docs/05-standards/testing.md]
---
# Testing

The tests every platform shares (the contract, the layout, the generators, what a golden and a conformance example
are) are in [testing a platform](../../../docs/05-standards/testing.md). Here: what this platform adds.

## What is tested at each level

| Level | What it covers | Run by |
|---|---|---|
| The compiler's tests | Every example built and compared with its golden: `examples/expected/rick_api/`, `examples/expected/tasks_api/` (`nuclearlang/crates/nuclear-transpile/tests/projects.rs`), `examples/examples-nestjs/users.ts` (`golden.rs`); conformance: `tasks_api` built with `nestjs` and `fastapi` (`backend_example_builds_with_every_backend_dialect`); `tasks_api` also as the backend of the mobile `tasks_app` | `cargo test` at the root of the tree |
| The runtimes' tests | `packages/dragonfly-py/tests/` (pytest), `packages/dragonfly-nest/test/` (`node:test`) | the two checks |
| The fastapi check | `rick_api` built; pyright `--strict` and the project's own tests on the generated code; a live run; then the conformance example | `checks/fastapi-check/check.sh` |
| The nestjs check | the runtime built; `tasks_api` built; `tsc --strict` and the project's own tests; a live run; the migrations | `checks/nestjs-check/check.sh` |
| The references' equivalences | each dialect's reference against the real output (the dialects' projects own them) | `nuclearlang/tools/spec-check/check.py` |

## Set up, once

From the root of the tree:

```sh
(cd nuclearlang/tools/node && npm install)
python3 -m venv nuclearlang/tools/python/.venv
nuclearlang/tools/python/.venv/bin/pip install -r nuclearlang/tools/python/requirements.txt
nuclearlang/tools/python/.venv/bin/pip install -e nuclear-synapsis-framework/platforms/backend/packages/dragonfly-py --config-settings editable_mode=compat
(cd nuclear-synapsis-framework/platforms/backend/packages/dragonfly-nest && npm install)
```

## Running the checks

```sh
cargo test
sh nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh
sh nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh
```

Both scripts find the tree from their own place (`NUCLEAR_ROOT` overrides it), build with
`cargo run -p nuclear-cli -- build` and stop at the first failure, printing the failed command's whole output.

**`fastapi-check/check.sh`**, in order:

1. Builds `examples/examples-fastapi/rick_api` into its `build/`.
2. pyright over the generated project, then its tests (pytest: the project's `test/*_test.nuc`).
3. `smoke.py`: the REST API over an in-memory database (201, 409, 400, 404, the list), the agent with its tools and
   the graph with a fake chat model (no network), and `/openapi.json`.
4. The runtime's tests: `packages/dragonfly-py/tests`.
5. **Conformance**: copies `examples/examples-backend/tasks_api` (written for `nestjs`), switches its `config.nuc`
   to `dialect = "fastapi"`, builds it, runs pyright and its tests.
6. **Migrations**: on that copy, with `DATABASE` set to a fresh SQLite file, `dragonfly.migrate make "first"`,
   `up`, then `make "again"` must answer "no changes".

**`nestjs-check/check.sh`**, in order:

1. Builds the runtime with `tsc` and copies it fresh into `nuclearlang/tools/node/node_modules`
   (`npm install --no-save --install-links`). npm keeps an old copy of the same version, so the script removes it
   first; a `--no-save` install also prunes the other runtime installed the same way, so the web platform's check
   installs its own again.
2. Builds `examples/examples-backend/tasks_api` and links `node_modules` into its `build/`.
3. `tsc --strict`, then the project's tests (`node --test "dist/test/**/*.js"`).
4. `smoke.mjs`: the REST CRUD over SQLite in memory (`DRAGONFLY_DATABASE=memory`), validation (400 with two
   messages), the errors of a `Result` (409, 404).
5. **Migrations**: with `DATABASE` set to a fresh SQLite file, `migrate make "first"`, `up`, then `make "again"`
   must answer "no changes".
6. The runtime's tests (`tsconfig.test.json`, `dist-test/test/**/*.js`).

## Conventions

- **One feature, both dialects.** A feature has a test in Nuclear in the example (`test/*_test.nuc`), which each
  dialect runs with its own runner; a behaviour of the runtimes has the same test in both
  (`packages/dragonfly-py/tests/test_data.py`, `packages/dragonfly-nest/test/data.test.ts`).
- **Goldens.** When the generated output changes on purpose: `UPDATE_GOLDEN=1 cargo test`, then review the diff. An
  expected file the build no longer produces is a failure too.
- **No network, no real service.** The checks use SQLite (in memory or a temporary file) and fake chat models
  (`FakeModel`). What was never run against a real service is listed in the roadmaps (this one and each
  dialect's).
- **The tests of a project start from an empty database**: in memory, empty in each test.

## CI

`.github/workflows/platform-backend.yml`, on a change to `nuclearlang/**`, `tools/cli/**`, the Cargo files or this
folder: Node 26 and Python 3.14; `npm ci` in `nuclearlang/tools/node` and `installer/release/build-runtimes.sh`;
the Python tools and the runtime; the equivalences of the `fastapi` and `nestjs` references; then both checks.
