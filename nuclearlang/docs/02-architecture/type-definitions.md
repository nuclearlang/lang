---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [dialects.md, emitter.md, ../03-adr/0008-type-definitions-and-target-packages.md, ../../tools/defs/README.md]
---
# Type definitions

Read this when an import is missing or wrong, an override is not detected, or you regenerate `defs/`. Rules:
`docs/07-reference/definitions.md`. Decisions: ADR-lang-0008, ADR-lang-0005 (external classes).

Like `.d.ts` / `@types`: packages `name@version` in `dialects/<language>/defs/<package>/<version>/`, each with
`package.toml`, `index.json` (for the transpiler: classes, auto-imports, re-exports, `params`, `results`,
`defaults`) and `api.json` (the full API in Nuclear notation, read lazily: the language server, `nuclear defs`,
agents). GENERATED: never edit.

Packages of the `dart` language today: `dart@3.13.5`, `flutter@3.47.7`, `synapsis@0.1.0`, `flutter_bloc@9.1.1`,
`bloc@9.2.1`, `dio@5.11.1`, `get_it@9.3.0`, `go_router@18.1.1`, `connectivity_plus@7.3.2`,
`flutter_secure_storage@11.2.0`, `json_annotation@4.12.0`, and for the genkit plugin `genkit@1.0.1`,
`schemantic@1.0.0`, `synapsis_genkit@0.1.0`. `python` and `typescript` have theirs under their own `defs/`; the
list a dialect uses is its `[dialect] defs`.

## Loading and priority

`[dialect] defs = ["flutter@3.47.7", ...]` (added to the parent's). Priority: parent first, order of `defs`,
each package before its dependencies, inside a package the most basic library (widgets before material).
`implicit` libraries (dart:core) are never imported. Hand-written `[auto_imports]`/`[functions]` win. A name
two packages export with different declarations goes to the first: `Flow` → `dart:developer`, not the widget.
Validations N0213/N0214.

## Where they are found

`Loader::repository()`: the extra roots (`Loader.defs_paths`), then for each dialect search path its
`<language>/defs` and the `defs/` next to it (a project's own `dialects/` and `defs/`), then the cache of the
definitions generated for projects (`nuclear_dialect::defs_cache_dir`: `~/.cache/nuclearlang/defs`). A project's
own `defs/` and the cache keep `<language>/<package>/<version>/`.

## Project packages (ADR-lang-0008; ADR-mobile-0001, ADR-mobile-0001)

`nuclear add <package>` gives a project the definitions of any package of its target. Backend and web: generated
into `<project>/defs/<language>/<name>/<version>/` (`project::project_defs`). Mobile: generated once into the cache
and listed in `build/defs.lock` (`project::defs_lock`). Both are loaded with `project::with_project_defs`
(`Loader::add_defs`) by `nuclear build|check`, `nuclear defs` (inside the project) and the language server.
`Package::from_project` is false for the dialect's.

## How a name is imported (`emit.rs`, `imports`)

`Dialect.auto_imports` (name → module) says where a name comes from; `Dialect.default_imports` (name → module) says
which names are their module as a whole: a hand-written `[auto_imports] "math" = ["math"]` (`import math`) and a
package's `index.json` `defaults` (`import dayjs from 'dayjs'`). Every other name is imported by name, also one called
like its module (`from tqdm import tqdm`, `import { nanoid } from 'nanoid'`).

## What the emitter and the server take from them

- Overrides and inherited members of a class that is not in the file (`inherited_members`); a base with
  `kind = "interface"` goes to `implements`.
- `ClassDef.params` (the unnamed constructor): N0219 and N0220 without reading `api.json`
  (`tools/defs/index_params.py` adds them to packages generated before).
- `ClassDef.results`: methods that return a `Result`.
- A class in neither the file nor the definitions leaves the module open: no `@override`, no N0106
  ([limits.md](limits.md)).

## Generators

`tools/defs/bin/defs.dart` (one package) and `tools/defs/generate.sh` (all, about 45 s); `flutter_project/`
resolves Flutter plus the pub packages. `tools/defs/python/gen.py` (`inspect` over the installed modules;
`--distribution`) and `tools/defs/typescript/gen.js` (the TypeScript compiler over `.d.ts`; `--package`; the
default export goes to `defaults`). All are installed in `<install>/tools/defs` for the command line tools. A
dependency's library the app cannot resolve (a plugin it has not enabled) is skipped by `defs.dart`, not an
error. How to run them: [tools/defs/README.md](../../tools/defs/README.md).
