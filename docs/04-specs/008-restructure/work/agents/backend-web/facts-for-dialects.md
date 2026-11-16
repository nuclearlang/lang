# Facts about the dialects that were in the platforms' old CONTEXT.md

From `platforms/backend/docs/CONTEXT.md` and `platforms/web/docs/CONTEXT.md` (both deleted once distributed). They
describe how a dialect writes its target, so they were not carried into the platforms' docs (a platform links to
its dialects). Paths translated to the new tree. For the `python` / `typescript` dialect projects, if not already
in their documents.

## `fastapi` (`nuclearlang/dialects/python/frameworks/fastapi/`, extends `python`)

- FastAPI controllers; SQLAlchemy 2 async repositories: `Repository[E]`, a query per method call via
  `self_member = "q.{{name}}"`.
- pydantic models; graph states as pydantic models (`state.field`; a field without a default gets its type's empty
  value, `templates/state_field.tpl`).
- LangChain / LangGraph tools, agents and graphs; listeners (`conftest` creates them).
- pytest tests written to `tests/` from the platform's `test/`.
- `builtin_result = false`: Result comes from the runtime.
- The `python` dialect underneath is the base language in Python 3.12+ typed (emitter options of old ADR-0089:
  `hoist_block_lambdas`, `init_fields`, `doc_inside`, f-strings, `module_separator`, `toplevel_gap`,
  `type_args_as_args`, `file_prelude`, `snake_case_names`); its Result runtime is `templates/result.tpl`.
- Data (old ADR-0100): two entities import each other only under `if TYPE_CHECKING:` (`[kinds.entity]
  type_imports = true` + the python dialect's `[syntax] type_imports`); `main.py` and `conftest.py` list every
  entity (`entities=[...]`) so SQLAlchemy knows all tables.
- Goldens: `nuclearlang/examples/examples-python/tour.py` (`golden.rs`).
- Reference equivalences: `tools/spec-check/check.py dialects/python/docs/07-reference/python.md python python`,
  `... fastapi.md fastapi python` (from `nuclearlang/`).

## `nestjs` (`nuclearlang/dialects/typescript/frameworks/nestjs/`, extends nodejs → typescript)

- NestJS 12 ES modules, sequelize-typescript entities, `Repository<E>` with `@InjectModel`, class-validator DTOs,
  `alias_via = "constructor"` facades.
- Controllers: route / body / query from `route` + `tinfo.model`; the platform's `@get("{id}")` becomes
  `@Get(':id')` through `[options] route_param = ":name"` and `decor.get.path`.
- LangChain.js / LangGraph.js: `Annotation.Root` states, zod tool schemas; `node:test` tests.
- Project files: `src/app.module.ts` (a module per component via `components`), `src/main.ts`, `package.json`
  (`uses`, `plugins.packages`), `tsconfig.json`; `project_import = "{{relative}}.js"`.
- The generated `npm test` (what `dragonfly test` runs) removes `dist/test` before compiling: `tsc` never deletes
  the output of a source that is gone (from the backend platform's CHANGELOG).
- Reference equivalences: `tools/spec-check/check.py dialects/typescript/docs/07-reference/nestjs.md nestjs
  typescript` (from `nuclearlang/`).

## `react` (`nuclearlang/dialects/typescript/frameworks/react/`, extends `typescript`)

| Path | What it does |
|---|---|
| `dialect.toml` | kinds, decorators, `[architecture]`, `[project]` (`output = "build/app"`, `assets = ["public"]`), `[toolchain]`, `[call_site.Log]`, defs list, auto_imports of the runtime |
| `templates/` | kind templates; `dragonfly_g.tpl` → `src/dragonfly.g.ts` (startDragonfly, dragonflyConfig, registerModels, registerDragonfly, routes, appRouter); `index_ts.tpl`, `index_html.tpl`, `package_json.tpl`, `tsconfig.tpl`, `vite_config.tpl` |
| `docs.toml` | editor docs of every kind and decorator (required by a test) |

- `this.manager(X)` reads a provided manager through `[decorators.provide]`.
- The reference `react.md` has 3 equivalences checked by `tools/spec-check/check.py
  dialects/typescript/docs/07-reference/react.md react typescript`; the brief is printed by `nuclear spec --brief
  --dialect react` (its code compiles with the dialect); the guide `08-guides/react.md` is published on the website.
- The type definitions of `react`, `react_router`, `vitest`, `testing_library_react` and `dragonfly-web` are not
  in `nuclearlang/tools/defs/typescript/generate.sh` (the five `gen.js` commands were kept in a status log that no
  longer exists): a `TODO(human)` in `platforms/web/docs/06-runbooks/change-the-runtime.md`.
