---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../06-runbooks/type-definitions.md, ../02-architecture/fastapi.md, ../../../../tools/spec-check/check.py]
---
# Testing the `python` dialect

A change to this dialect is done when every check below that it touches is green. Which test of the compiler to
add for a new language rule is the language project's standard ([its AGENTS.md](../../../../AGENTS.md)).

## What each check proves

| Check | Run from | Proves |
|---|---|---|
| `cargo test` | the root of the tree | the goldens: `nuclearlang/examples/examples-python/tour.nuc` → `tour.py`, and the projects `rick_api` and `tasks_api` of the backend platform against their `examples/expected/`; the dialect files load and validate; every kind, decorator and header word has its `docs.toml` entry (`every_dialect_word_has_editor_docs`) |
| `cargo run -q -p nuclear-cli -- dialect check python` (or `fastapi`) | the root | the dialect alone loads without problems |
| `tools/spec-check/check.py dialects/python/docs/07-reference/python.md python python` | `nuclearlang/` | every Python block of the reference that follows a Nuclear block is, line by line, in the transpiler's real output. 0 problems |
| `tools/spec-check/check.py dialects/python/docs/07-reference/fastapi.md fastapi python` | `nuclearlang/` | the same for the `fastapi` reference. A brief is checked the same way (`dialects/python/docs/07-reference/brief/<dialect>.md`): its code compiles with the dialect |
| `tools/stdlib-check.sh [area...]` | anywhere | each program of `nuclearlang/examples/stdlib/` built with `--dialect python` passes `pyright --strict` and prints its `<area>.out`, the same text TypeScript and Dart print |
| `nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh` | anywhere | the generated project is right against the real target (below) |

`UPDATE_GOLDEN=1 cargo test -p nuclear-transpile` accepts a changed output: review the diff. `spec-check ... --fix`
rewrites the reference's blocks that differ: review them too.

## The `fastapi` check, step by step

`fastapi-check/check.sh` uses the virtual environment `nuclearlang/tools/python/.venv`:

1. builds `examples/examples-fastapi/rick_api` of the backend platform;
2. `pyright` (strict, set by the generated `pyproject.toml`) over `build/`;
3. `pytest`: the project's tests written in Nuclear;
4. `smoke.py`: an end-to-end run over an in-memory database with a fake chat model, no network (REST CRUD, 409,
   400, 404, the agent over HTTP, its tools, the graph, OpenAPI);
5. the runtime's own tests (`packages/synapsis-py/tests`);
6. conformance: copies `examples/examples-backend/tasks_api` (written for `nestjs`), sets `dialect = "fastapi"` in
   its `config.nuc`, builds it, and runs `pyright` and `pytest` again;
7. migrations of that copy: made from the entities, applied to a fresh SQLite, then nothing is left to make.

## Setting up the environment

From `nuclearlang/`:

```sh
python3 -m venv tools/python/.venv
tools/python/.venv/bin/pip install -r tools/python/requirements.txt
tools/python/.venv/bin/pip install -e ../nuclear-synapsis-framework/platforms/backend/packages/synapsis-py \
  --config-settings editable_mode=compat
```

`stdlib-check.sh` also needs node, dart and TypeScript for the other two targets; `PY=<python>` and
`PYRIGHT=<pyright>` choose another interpreter.

## Rules

- The generated code passes `pyright --strict`.
- A new equivalence in the reference is written as a Nuclear block followed by its Python block, so `spec-check`
  covers it.
- A new kind, decorator or header word comes with its `docs.toml` entry in the same change.
- What was never run against the real target is listed in [the roadmap](../01-product/roadmap.md), *Untested*.
