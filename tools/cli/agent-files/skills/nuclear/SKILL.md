---
name: nuclear
description: Write, fix or review NuclearLang code (.nuc files, nuclear.toml, Synapsis projects with config.nuc: mobile apps with the flutter dialect, backends with the fastapi (Python) or nestjs (TypeScript) dialect). Use it whenever a task touches a .nuc file or the `nuclear` command line tool.
---

# NuclearLang

NuclearLang (`.nuc`) is a minimal language transpiled to TypeScript, Dart or Python by declarative dialects. Synapsis
is its framework: three platforms written in Nuclear — `mobile` (dialect `flutter`: the Flutter app is generated in
`build/app`), `backend` (dialects `fastapi` = Python/FastAPI and `nestjs` = TypeScript, built to `build/` by
`nuclear build .`) and `web` (dialect `react` = TypeScript/React). The Nuclear of a platform is the same for every dialect of it; only
the standard library of Nuclear is used on strings, lists and maps (`nuclear help library`), never the target's. Its
syntax is NOT TypeScript, Dart nor Python: read the sheet before writing.

**Make it with the tools.** A product (any software made from Nuclear) is made with the platform's tools:
`nuclear new`, `nuclear gen`, `nuclear make`, the MCP server's tools, `nuclear add` for a library, `nuclear fix`; only
what they leave is written by hand, in Nuclear. Never write target code (`.ts`, `.dart`, `.py`) for a feature, and
never translate React, Node.js, Python or Dart code into Nuclear by hand. Only when strictly necessary, and then say
so: the tool that should have done it is missing something.

## 1. Load the sheet (once per task, ~3k tokens)

New to Nuclear: `nuclear help start` (MCP `nuclear_start`) first: what it is, the rules, the cycle; then
`nuclear help atlas` lists every topic (the platforms, the dialects, the tools, `example/<name>`).

```sh
nuclear spec --brief --dialect flutter     # Synapsis app (config.nuc + main.nuc, no nuclear.toml)
nuclear spec --brief --dialect <dialect>   # the dialect of config.nuc (fastapi, nestjs) or nuclear.toml (typescript, dart, python)
```

It says only what changes from TypeScript/Dart. Do not load the full spec (`nuclear spec`) unless the sheet and
`nuclear help <topic>` do not answer.

## 2. Work cycle

1. Synapsis: generate a resource's finished code first (models, repository, a use case per action, the facade,
   the controller or the screen, tests): `nuclear gen inspect`, then `nuclear gen resource <component> <Name>
   --from-json <url|file> | --from-spec <spec.md> | --fields "id:int name:string"` (ADR-codegen-0001). Write by hand only
   what is left. A use case you wrote is wired by `nuclear gen usecase <component> <Name> [--route "POST
   orders/{id}/cancel"]` (its alias in the facade; backend: its route); one that only calls a repository method is
   written by it too (`--calls <Repository>.<method>`). With the Nuclear MCP server, call `graph_strategy` first with
   the request: it answers which kind of request it is (a resource, one screen, a rename, a failing test...) and the
   plan of that kind. Create each other piece with its generator, so it lands in
   the right folder with the right kind:
   `nuclear make component|screen|usecase|repository|model|event|guard|widget|page|test ...` (`nuclear help`).
2. Write the code following the sheet. Copy the style of the project's existing `.nuc` files.
3. Check until clean, and fix exactly what each error says (most carry a `fix`):
   - Synapsis: `nuclear check --json` (must print `[]`), then `nuclear analyze` (no `error •` lines) and, with
     tests, `nuclear test`.
   - fastapi: `nuclear check . --json`, `nuclear build .`, then in `build/`: `pyright` and `pytest`.
   - Other projects: `nuclear check <folder> --json`; a single file: `nuclear check file.nuc --dialect <d> --json`,
     then `nuclear build file.nuc --dialect <d> -o file.ts`.
4. Format what you wrote: `nuclear fmt <folder>` (only spacing and indentation; `--check` lists what would change).
5. Never edit generated files (`build/`, `*.g.dart`, the `.ts`/`.dart` output): change the `.nuc` and rebuild.

## 3. Look up instead of guessing

- A class, constructor, argument or member of Flutter, Dart or a package:
  `nuclear defs show <Name> --dialect flutter` (or `<Name.member>`); `nuclear defs search <text> --dialect flutter`.
  Inside the project they also show the packages the project added.
- A library the project does not have (npm, PyPI, pub.dev, for the project's dialect): `nuclear add <package>`
  (`<package>@<version>`) installs it, writes it in `config.nuc` and generates its type definitions; then its names are
  used directly, without `use` (the import is written for you). `nuclear remove <package>` takes it out. Never
  install a package by hand inside `build/`. A package's default export is one name (`dayjs()`, `lodash.chunk(...)`).
- A kind, decorator or header word of the dialect (what it generates, its rules, an example):
  `nuclear help <word> --dialect <d>` (`repository`, `@screen`...); every word: `nuclear help words --dialect <d>`; where a kind's file goes: `nuclear help layout --dialect <d>`.
- A language or framework topic: `nuclear help` lists them (`results`, `flutter`, `synapsis`, `tutorial`...).
- A runtime error of the app: `nuclear explain` (reads the error on stdin and points to the `.nuc` line).

## 4. Mistakes agents make

The compiler catches the habits of TypeScript, Dart and Python (`N0022`, with an exact `fix`), invented classes
(`N0220`) and invented named arguments (`N0219`, it lists the real ones). Apply the fix instead of rewriting.

- Writing `return`, `;`, `{ }`, `new`, `await`, `const`/`final`/`var`, `&&`, `!x`, `name: value` arguments: use the
  sheet's forms (`~x`, `x = 1`, `and`, `not x`, `name = value`).
- The return type goes after the parameters: `load(id: int) User`.
- Porting TypeScript: `===` and `!==` are `==` and `!=`. Between lists, maps or sets Nuclear's `==` compares what
  they hold, not whether they are the same object: check each `===` between arrays or maps the original relied on.
- In Synapsis, a screen calls its `statemanager`, which calls the component's `appcomponent`; only the use case
  calls the repository. Another component sees only the `appcomponent`, models, events, guards and screens.
- Real time, guards and a host page are configuration, never hand-written sockets or middleware: a backend's
  `WebSocketServer(path = "ws")` and `guards: Guard[] = [NoOrigin(), Token(value = env("T"))]` in its `appConfig`
  (`nuclear new -p backend --websocket --token T`); a web app's `WebSocket(url = ...)` connection, `@on("topic")`
  repository methods returning `Stream<T>`, `listen(stream, ...)` in a manager; `mount(element, host)` for a host page.
- Texts shown to the user are translation keys: `"component.screen.key".tr()` plus the key in
  `assets/i18n/<locale>/<component>.json`.
