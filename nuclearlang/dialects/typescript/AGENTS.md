# The `typescript` dialect

How Nuclear is written in TypeScript, and in the frameworks built on TypeScript. The same Nuclear code is written
once and the transpiler turns it into each language and framework: this dialect only decides HOW the output is
written in TypeScript (templates, imports, the standard library), never what the Nuclear code is. Its framework
dialects implement platforms of Dragonfly: `nestjs` the
[backend platform](../../../nuclear-synapsis-framework/platforms/backend/AGENTS.md), `react` the
[web platform](../../../nuclear-synapsis-framework/platforms/web/AGENTS.md). What a platform is (kinds, decorators,
layout) is the platform's, not described here.

Paths in these documents are relative to this folder (`nuclearlang/dialects/typescript/`). `../../` is the language
project ([its AGENTS.md](../../AGENTS.md)); `../../../` is the root of the tree.

## Stack

- Target: TypeScript 5 with ES modules; the output passes `tsc --strict`.
- The dialect: TOML tables and Mustache-subset templates, read at run time by `../../crates/nuclear-dialect`.
- `nestjs` (platform `backend`; extends [`nodejs`](../nodejs/AGENTS.md), which extends this dialect): NestJS 12
  (ES modules), Sequelize (`@nestjs/sequelize` + `sequelize-typescript`), class-validator, kafkajs, ioredis,
  LangChain.js / LangGraph.js, `node:test`. Runtime: the platform's package `dragonfly-nest`.
- `react` (platform `web`): React 19 without JSX, React Router 7, Vite 7, Vitest 4 + jsdom + Testing Library.
  Runtime: the platform's package `dragonfly-web`.
- Type definitions: generated from `.d.ts` files by `../../tools/defs/typescript/` over
  `../../tools/node/node_modules`.

## Commands

```sh
# from the root of the tree
cargo test                                     # goldens (base.ts, users.ts, tasks_api, characters), validation, editor docs
UPDATE_GOLDEN=1 cargo test -p nuclear-transpile    # accept a changed output, then review the diff
cargo run -q -p nuclear-cli -- build <file.nuc> --dialect typescript [-o out.ts]
cargo run -q -p nuclear-cli -- dialect check typescript  # or nestjs, react
cargo run -q -p nuclear-cli -- spec --dialect nestjs     # the contract: templates, variables, options
nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh   # tsc --strict, node:test, a live run
nuclear-synapsis-framework/platforms/web/checks/react-check/check.sh        # tsc --strict, vitest, vite build

# from nuclearlang/
tools/spec-check/check.py dialects/typescript/docs/07-reference/typescript.md typescript typescript [--fix]
tools/spec-check/check.py dialects/typescript/docs/07-reference/nestjs.md nestjs typescript [--fix]
tools/spec-check/check.py dialects/typescript/docs/07-reference/react.md react typescript [--fix]
tools/stdlib-check.sh [area...]                # the standard library in TypeScript, Dart and Python: the same output
tools/defs/typescript/generate.sh              # regenerate defs/ (TypeScript's library and the nestjs packages)
```

What each check needs and proves: [docs/05-standards/testing.md](docs/05-standards/testing.md).

## Folders

- `dialect.toml`: `[options]`, `[syntax]`, `[types]`, `[operators]`, global names, `[functions]`, `[modifiers]`.
- `keywords.toml`: TypeScript's reserved words and how each is produced from Nuclear.
- `library.toml`: Nuclear's standard library written in TypeScript (one template per member).
- `docs.toml`: what the editor shows for each header word.
- `templates/`: `result.tpl` (the `Result` runtime of a file), `doc_comment.tpl` (JSDoc).
- `frameworks/nestjs/`, `frameworks/react/`: the framework dialects (`dialect.toml`, `docs.toml`, `templates/`).
- `defs/<package>/<version>/`: type definitions. Generated.
- `docs/`: the context documentation (map below). `docs/07-reference/` and `docs/08-guides/` are normative and
  user texts, checked by tools and embedded in the `nuclear` binary.

## Rules of this project

- **The `.nuc` never bends to TypeScript.** Names are written as they are: Nuclear's `camelCase` is TypeScript's.
- **Nothing of TypeScript in Rust.** A need of this target is asked of the compiler as a generic `[options]` key or
  template variable (the language project decides it), never as a case of one language.
- **The library is Nuclear's.** Every member of [the standard library](../../docs/07-reference/library.md) has its
  template in `library.toml`; a TypeScript name (`push`, `toUpperCase`) in Nuclear code, in a reference or in an
  example is a bug.
- **A framework dialect only writes the platform.** A kind, a decorator or a folder is added to the platform's
  contract first, for every dialect of the platform; `frameworks/<name>/` adds how it is written in TypeScript.
- The generated code passes `tsc --strict`.
- The order of `defs` in a framework dialect decides which package gives a name two of them export: change it only
  knowing which name moves.
- [`nodejs`](../nodejs/AGENTS.md) sits between this dialect and `nestjs` and is postponed by the user: do not
  touch it until asked.
- `docs/07-reference/*.md` hold only final rules and real equivalences (`spec-check`, 0 problems). Never edit an
  equivalence by hand: change the dialect, then `--fix` and review.
- Every kind, decorator and header word has its entry in `docs.toml` (test `every_dialect_word_has_editor_docs`).
- `defs/` is generated: never edited. After a version or a runtime API changes, regenerate it
  ([runbook](docs/06-runbooks/type-definitions.md)) and update the `defs` lists.
- Output changed: `UPDATE_GOLDEN=1 cargo test`, the diff reviewed, the reference fixed in the same change.
- A structural decision (a library, a pattern of the generated code) is a new ADR in `docs/03-adr/`.
- What is not documented and cannot be read from the dialect files is asked, not invented.

## Documents (open one only when its line matches the task)

| You need | Read |
|---|---|
| The pending work of this dialect, of `nestjs` and of `react` | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| How the base language is written in TypeScript: options, `Result`, imports, the library | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| How `nestjs` writes each kind of the backend platform; its project files, plugins and toolchain | [docs/02-architecture/nestjs.md](docs/02-architecture/nestjs.md) |
| How `react` writes each kind of the web platform; its project files and toolchain | [docs/02-architecture/react.md](docs/02-architecture/react.md) |
| A target version, a library the output uses, a type definitions package | [docs/02-architecture/dependencies.md](docs/02-architecture/dependencies.md) |
| Why `nestjs` is written this way; why these libraries | [docs/03-adr/README.md](docs/03-adr/README.md) |
| Which check to run, what it needs and what it proves | [docs/05-standards/testing.md](docs/05-standards/testing.md) |
| Regenerating `defs/`, adding a package | [docs/06-runbooks/type-definitions.md](docs/06-runbooks/type-definitions.md) |
| The normative Nuclear → TypeScript equivalences | `docs/07-reference/typescript.md`, `nestjs.md`, `react.md` |
| The short sheet an agent gets (`nuclear spec --brief`) | `docs/07-reference/brief/typescript.md`, `brief/nestjs.md`, `brief/react.md` |
| The guide a user reads | `docs/08-guides/nestjs.md`, `docs/08-guides/react.md` (published on the website) |
| The format of a dialect file (sections, templates, validation) | [../../docs/07-reference/dialects.md](../../docs/07-reference/dialects.md) |
| The other dialects | [../README.md](../README.md) |
| The platforms `nestjs` and `react` implement | [backend](../../../nuclear-synapsis-framework/platforms/backend/AGENTS.md), [web](../../../nuclear-synapsis-framework/platforms/web/AGENTS.md) |
