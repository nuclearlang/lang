---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../06-runbooks/type-definitions.md, ../02-architecture/nestjs.md, ../02-architecture/react.md, ../../../../tools/spec-check/check.py]
---
# Testing the `typescript` dialect

A change to this dialect is done when every check below that it touches is green. Which test of the compiler to
add for a new language rule is the language project's standard ([its AGENTS.md](../../../../AGENTS.md)).

## What each check proves

| Check | Run from | Proves |
|---|---|---|
| `cargo test` | the root of the tree | the goldens: `nuclearlang/examples/spec/base.nuc` → `base.ts`, `examples-nestjs/users.nuc` → `users.ts` of the backend platform, and the projects `tasks_api` (`nestjs`) and `characters` (`react`) against their `examples/expected/`; the dialect files load and validate; every kind, decorator and header word has its `docs.toml` entry (`every_dialect_word_has_editor_docs`) |
| `cargo run -q -p nuclear-cli -- dialect check typescript` (or `nestjs`, `react`) | the root | the dialect alone loads without problems |
| `tools/spec-check/check.py dialects/typescript/docs/07-reference/<dialect>.md <dialect> typescript` | `nuclearlang/` | every TypeScript block of a reference (`typescript`, `nestjs`, `react`) that follows a Nuclear block is, line by line, in the transpiler's real output. 0 problems (`react.md` has 3 checked equivalences). A brief is checked the same way (`dialects/typescript/docs/07-reference/brief/<dialect>.md`): its code compiles with the dialect |
| `tools/stdlib-check.sh [area...]` | anywhere | each program of `nuclearlang/examples/stdlib/` built with `--dialect typescript` passes `tsc --strict`, runs on node and prints its `<area>.out`, the same text Dart and Python print. `UPDATE=1` makes the TypeScript output the expected one |
| `nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh` | anywhere | the generated `nestjs` project is right against the real target (below) |
| `nuclear-synapsis-framework/platforms/web/checks/react-check/check.sh` | anywhere | the generated `react` app is right against the real target (below) |

`UPDATE_GOLDEN=1 cargo test -p nuclear-transpile` accepts a changed output: review the diff. `spec-check ... --fix`
rewrites the reference's blocks that differ: review them too.

One file by hand, with the TypeScript the tools install (there is no global `tsc`):

```sh
node nuclearlang/tools/node/node_modules/typescript/bin/tsc --strict --noEmit --target es2022 --lib es2022,dom x.ts
```

## The `nestjs` check, step by step

1. compiles the runtime `packages/synapsis-nest` of the backend platform and copies it fresh into
   `nuclearlang/tools/node/node_modules` (`npm install --no-save --install-links`);
2. builds `examples/examples-backend/tasks_api` and links those `node_modules` into its `build/`;
3. `tsc -p tsconfig.json` (strict);
4. `node --test "dist/test/**/*.js"`: the project's tests written in Nuclear;
5. `smoke.mjs`: an end-to-end run over SQLite in memory (REST CRUD, validation with 400, 404, 409);
6. migrations: made from the entities, applied to a fresh SQLite, then nothing is left to make;
7. the runtime's own tests.

## The `react` check, step by step

1. compiles the runtime `packages/synapsis-web` of the web platform and copies it fresh into
   `nuclearlang/tools/node/node_modules`;
2. builds `examples/examples-web/characters` and links those `node_modules` into its `build/app`;
3. `tsc -p tsconfig.json` (strict);
4. `vitest run`: the app's tests written in Nuclear (jsdom);
5. `vite build`: a production bundle;
6. the runtime's own tests (vitest).

## Setting up the environment

```sh
(cd nuclearlang/tools/node && npm install)
# each runtime builds with its own devDependencies
(cd nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest && npm install)
(cd nuclear-synapsis-framework/platforms/web/packages/synapsis-web && npm install)
```

- A runtime is installed into `nuclearlang/tools/node` as a copy, never a link: a symlink resolves its peers in
  its own `node_modules`, and two copies of `@nestjs/common` break `tsc`. Each check script does it again, because
  npm keeps an old copy of the same version and a `--no-save` install prunes the other runtime installed the same
  way.
- `stdlib-check.sh` also needs dart and `nuclearlang/tools/python/.venv` for the other two targets; `TSC=<path to
  tsc>` chooses another compiler.

## Rules

- The generated code passes `tsc --strict`.
- A new equivalence in a reference is written as a Nuclear block followed by its TypeScript block, so `spec-check`
  covers it.
- A new kind, decorator or header word comes with its `docs.toml` entry in the same change.
- What was never run against the real target is listed in [the roadmap](../01-product/roadmap.md), *Untested*.
