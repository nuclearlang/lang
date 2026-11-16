# Dialects

A **dialect** is the data that says how Nuclear is written in one target: TOML tables and templates the compiler
loads at run time. The same `.nuc` is written once and each dialect turns it into its language or framework.

## Why they exist

A language built for agents should not need a new compiler for every target, and its code should not bend to the
target it happens to be built for. A dialect decides only HOW the output is written; it never decides what the
Nuclear code is: the `.nuc` of a project does not change when its dialect changes. Adding a target or a framework
is writing data files, templates and tests, not Rust. What a dialect leaves out on purpose: it never reads target
code, and it never wraps the target's libraries (they are used as they are, through their type definitions).

## How we made them

- **Rust decides what is emitted, the dialect decides how.** Nothing of a target lives in the compiler: a need of
  one target becomes a generic option or template variable any dialect can use. Python was the proof: everything
  it needed became generic emitter options (ADR-python-0001, [python/docs/03-adr/](python/docs/03-adr/README.md)).
- **Language dialects and framework dialects.** A language dialect extends no other and translates the whole base
  and Nuclear's standard library. A framework dialect names its language (`extends`) and the Synapsis platform it
  writes (`platform = "backend"`); the platform's contract says which kinds exist, the dialect only how each is
  written. Kinds never differ between the dialects of one platform.
- **Official libraries, not code of our own**: the generated app relies on the target ecosystem's most used
  libraries (ADR-dart-0001, ADR-python-0002, ADR-typescript-0001).
- **The imports come from type definitions** generated from the installed target packages, versioned like `.d.ts`
  (ADR-lang-0008, [../docs/03-adr/](../docs/03-adr/README.md)).
- **The reference is checked.** Each dialect's `docs/07-reference/<dialect>.md` holds the real Nuclear → target
  equivalences, verified by `../tools/spec-check/check.py` with 0 problems.

| Dialect | Target | Framework dialects (the platform each implements) | Read |
|---|---|---|---|
| `python` | Python 3.12+ typed, checked with `pyright --strict` | `fastapi` (backend) | [python/](python/README.md) |
| `typescript` | TypeScript 5 with ES modules, checked with `tsc --strict` | `nestjs` (backend), `react` (web) | [typescript/](typescript/README.md) |
| `dart` | Dart 3, checked with `flutter analyze` | `flutter` (mobile) | [dart/](dart/README.md) |
| `nodejs` | TypeScript for Node.js. Postponed by the user | none of its own; `nestjs` extends it | [nodejs/](nodejs/AGENTS.md) |

Inheritance (`extends` in each `dialect.toml`):

```
typescript ─► nodejs ─► nestjs     backend platform
typescript ─► react                web platform
python ─────► fastapi              backend platform
dart ───────► flutter              mobile platform
```

## What every dialect folder has

`dialect.toml` (options, `[syntax]`, `[types]`, `[operators]`, names, imports), `keywords.toml` (the target's
reserved words), `library.toml` (Nuclear's standard library in the target), `docs.toml` (what the editor shows for
each word; a build never reads it), `templates/*.tpl`, `frameworks/<name>/`, `defs/<package>/<version>/` (type
definitions, generated, never edited by hand) and `docs/`. A dialect's name is its folder's.

## Try it

From the root of the tree (or with the installed `nuclear`):

```sh
cargo run -q -p nuclear-cli -- dialect list              # every dialect, its chain and one line about it
cargo run -q -p nuclear-cli -- dialect check flutter     # dialect 'flutter' (flutter → dart) is valid: 28 kinds, ...
cargo run -q -p nuclear-cli -- spec --dialect fastapi    # the contract: templates, variables, options
cd nuclearlang && tools/stdlib-check.sh strings          # ok strings typescript / dart / python: the same output
```

## Where to read next

- [The dialect format](../docs/07-reference/dialects.md): sections, templates, variables, validation, where the
  loader finds a dialect.
- [Create a dialect with an agent](../docs/08-guides/create-a-dialect-with-an-agent.md).
- [Type definitions](../docs/07-reference/definitions.md) and [the standard library](../docs/07-reference/library.md)
  every language dialect translates.
- The platforms the framework dialects write:
  [../../nuclear-synapsis-framework/platforms/](../../nuclear-synapsis-framework/platforms/AGENTS.md).
- Each dialect's `AGENTS.md`, to change it.
