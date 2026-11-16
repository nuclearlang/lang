# Dialects

The same Nuclear code is written once and the transpiler turns it into each language and framework. A **dialect** is
the data that says HOW the output is written in one target: TOML tables and templates the compiler loads at run
time. A dialect never decides what the Nuclear code is: the `.nuc` of a project does not change when its dialect
changes.

Each language dialect is a project of its own, with its `AGENTS.md` and its `docs/`.

## Map

| Dialect | Target | Framework dialects (the platform each implements) | Start here |
|---|---|---|---|
| `python` | Python 3.12+ typed, checked with `pyright --strict` | `fastapi` (backend) | [python/AGENTS.md](python/AGENTS.md) |
| `typescript` | TypeScript 5 with ES modules, checked with `tsc --strict` | `nestjs` (backend), `react` (web) | [typescript/AGENTS.md](typescript/AGENTS.md) |
| `dart` | Dart 3 | `flutter` (mobile) | [dart/AGENTS.md](dart/AGENTS.md) |
| `nodejs` | TypeScript for Node.js. Postponed by the user: not touched until asked | none of its own; `nestjs` extends it | [nodejs/AGENTS.md](nodejs/AGENTS.md) |

Inheritance (`extends` in each `dialect.toml`):

```
typescript ─► nodejs ─► nestjs     backend platform
typescript ─► react                web platform
python ─────► fastapi              backend platform
dart ───────► flutter              mobile platform
```

## What is common to all

- **One folder per language**, `nuclearlang/dialects/<language>/`: `dialect.toml` (options, `[syntax]`, `[types]`,
  `[operators]`, names, imports), `keywords.toml` (the target's reserved words), `library.toml` (Nuclear's standard
  library written in the target), `docs.toml` (what the editor shows for each word), `templates/*.tpl`,
  `frameworks/<name>/` (its framework dialects), `defs/<package>/<version>/` (type definitions) and `docs/`.
  A dialect's name is its folder's.
- **A language dialect** extends no other: it defines every `[syntax]` template and one template per member of the
  standard library.
- **A framework dialect** names its language (`extends`) and its platform (`platform = "backend"`). The platform's
  contract (kinds, decorators, layout) is `nuclear-synapsis-framework/platforms/<platform>/platform.toml`; the
  dialect adds only how each kind is written (templates), the target's imports, the project files and the
  `[toolchain]` commands. Kinds never differ between the dialects of one platform.
- **Rust decides what is emitted; the dialect decides how.** Nothing of a target lives in the compiler: a need of
  one target becomes a generic option or template variable any dialect can use.
- **`defs/` is generated** by `nuclearlang/tools/defs/` from the installed target packages. Never edited by hand.
- **`docs.toml`** is skipped by the loader (a build never reads it); a test requires an entry for every kind,
  decorator and header word.
- **The reference is checked.** `docs/07-reference/<dialect>.md` holds the real Nuclear → target equivalences
  (`nuclearlang/tools/spec-check/check.py`, 0 problems); `docs/07-reference/brief/<dialect>.md` is the short sheet
  for agents (`nuclear spec --brief --dialect <dialect>`).

The format of a dialect (sections, templates, variables, validation, how the loader finds a dialect):
[../docs/07-reference/dialects.md](../docs/07-reference/dialects.md). The generated tables of templates, variables
and options: `nuclear spec`. Type definitions: [../docs/07-reference/definitions.md](../docs/07-reference/definitions.md).
The standard library every language dialect translates: [../docs/07-reference/library.md](../docs/07-reference/library.md).
