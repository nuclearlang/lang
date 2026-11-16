---
status: accepted
date: 2026-11-15
deciders: Julian Molina
---
# ADR-0008: The target's libraries are described by versioned type definitions, and any package of the target is added through Nuclear with its definitions generated

## Context and problem

The compiler only knows the names its type definitions give it: any other name is N0106. Hand-written lists of
symbols did not scale, and a project uses libraries nobody described for Nuclear: `lodash` under nestjs, `humanize`
under fastapi, `cached_network_image` under flutter. The user's rule: any library of the dialect's technology is
installed through Nuclear and only through Nuclear, with that technology's own package manager underneath; Nuclear
takes the package and creates every definition the compiler, the language server and the dialect need, as
TypeScript does with a package's types. By a command or by asking the agent.

## Decision

**The format.** Like TypeScript's `.d.ts` / `@types`: packages `name@version`, per language, in
`dialects/<language>/defs/<package>/<version>/`: `package.toml`, `index.json` for the transpiler, `api.json` with
the full API for the language server and the agents. Types in Nuclear notation. A dialect lists them in
`[dialect] defs`; they give the automatic imports, the inherited members and the overrides. One generator per
language (`tools/defs/`).

**One command on every platform.** `dragonfly add <package>[@version]... [--module <module>]...` and
`dragonfly remove <package>...`. A folder is still a kind package (ADR-synapsis-0004); a name is a package of the target.
The package is installed in the generated project, written in `dependencies(...)` of `config.nuc` with the version
the package manager resolved, and described: its definitions are generated from what is installed.

**The dialect says how; Rust knows no package manager.** A backend or web dialect gives the commands in
`[toolchain]`: `package_add`, `package_remove`, `package_version`, `package_defs`, the texts `package_requirement`,
`package_constraint`, `package_exact`, and `package_companion` (the package that carries the types of one that
ships none: `@types/lodash`, added and removed with it). The mobile platform keeps its own path (`flutter pub add`,
definitions by Dart's analyzer).

**Where a project's definitions live.** A backend or web project keeps them in the project,
`defs/<language>/<name>/<version>/`, with the sources: a project just cloned compiles before anything is installed.
`dragonfly install` generates the ones that are missing (a package written by hand in `config.nuc`). Mobile keeps
the shared cache and `build/defs.lock`.

**A name is imported as what it is.** `index.json` has `defaults`: the symbols that are the default export of their
library (`import dayjs from 'dayjs'`). Every other symbol is a name of its library, also one called like it
(`import { nanoid } from 'nanoid'`, `from tqdm import tqdm`). A module written as itself in a dialect file
(`[auto_imports] "math" = ["math"]`) stays the module (`import math`). The default export is called as the package
declares it (`dayjs`, `React`) or, when that is no name to write (`_`, `e`, none), like the module (`lodash`,
`express`).

**Any package name is written in `config.nuc`.** `name = "version"` when the name is an identifier,
`"name@version"` otherwise (`"date-fns@^4.1.0"`, `"@nestjs/axios@^12.0.0"`): split at the first `@` that is not the
first character. The parser does not change.

**Advice, never a refusal.** `[project.manifest.advice]` of a dialect names packages the platform already covers
(`express` under nestjs: the `controller` kind). Adding one says so and adds it. Only what the framework itself
uses stays refused (`reserved`, the dialect's `defs`).

**The tools read the project's packages.** `nuclear defs show|list|search` inside a project include them, as
`nuclear check`, `nuclear build` and the language server do.

**Through the agent.** The MCP tool `dragonfly` runs `add` and `remove`; `nuclear_defs` takes the project's folder;
the skill and a project's `AGENTS.md` say that a missing library is added with `dragonfly add`, never by hand in
`build/`.

**Not decided: a library of another language** (a Python library inside a project of the TypeScript dialect). It is
not a matter of definitions (`gen.py` already describes the library): what is missing is where its code runs. To
decide when a project needs it.

## Options considered

1. Hand-written symbol lists (`symbols.toml`): replaced by the definitions packages.
2. For a library of another language, a second process: the library behind a small service the generated code
   calls. It needs the emitter to write every call to a foreign name as an awaited call to a generated client, and
   the toolchain to keep a second environment and start and stop the process with the app, its tests and its
   container. Only data that travels as JSON; a class becomes a remote handle with a lifetime; no callbacks; every
   call is asynchronous and slower. The only general way; its plain form works today by hand (a fastapi project that
   exposes the library and the nestjs project reading its contract, ADR-synapsis-0006). One command for it is weeks of
   work for functions with plain data on the backend platform, much more for objects with state; in a browser or a
   phone it is only ever a call to a backend.
3. For a library of another language, the interpreter inside Node (a native bridge, or Pyodide): a native build per
   system, or WebAssembly; fragile to install; Pyodide runs pure Python and few compiled packages.
4. Translating the library: not feasible in general.

## Consequences

- Positive: the API is exact for the installed versions; an invented class or argument fails in Nuclear (old
  ADR-0088); a cloned backend or web project compiles before anything is installed.
- Negative:
  - A dialect without `package_*` commands cannot add packages; the command says which key is missing.
  - Projects with a `nuclear.toml` (the base dialects, built with `nuclear build`) have no command: they have no
    environment of their own to install into. They still keep definitions by hand in `defs/`.
  - The definitions describe the version installed when the package was added; `dragonfly add <package>` again
    regenerates them after an upgrade.
  - TypeScript: what a CommonJS package hangs from its exported value is reached through the default export
    (`lodash.chunk(...)`), not by name; a module other than the package's own is named with `--module`
    (`date-fns/locale`); a package with no types of its own nor an `@types` package cannot be described.
  - Python: the definitions are what the package's top modules export; a sub-module is named with `--module`.
  - The editors bundle the compiler: they are released with it.

## References

- `docs/07-reference/definitions.md`, `docs/02-architecture/type-definitions.md`, `tools/defs/README.md`.
- Replaces: ADR-0040, ADR-0108
