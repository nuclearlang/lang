# Nuclear's helpers of lodash

The functions of [lodash](https://lodash.com) that serve Nuclear, written once in Nuclear and transpiled to every
language dialect (TypeScript, Dart, Python, and the ones to come): helpers over lists, maps, texts, numbers and
functions. lodash is adapted to Nuclear, never the other way: typed signatures, one name per operation, nothing the
library of the language already has.

Paths in these documents are relative to this folder (`nuclear-synapsis-framework/lodash/`); a path that starts
with `nuclearlang/` or `.github/` starts at the root of the tree. The rules of the whole tree are in
[the root `AGENTS.md`](../../AGENTS.md).

**They are the language's own** (ADR-lang-0013): the compiler embeds `src/*.nuc` and brings into a program only the
helpers it calls, with no `use`. A change here changes what every Nuclear program can call.

## Stack

- Nuclear only: a project of the language (`nuclear.toml`, a language dialect), no platform and no runtime of a
  target. `src/` is the library, `test/` its tests.
- The check: `check.sh` (bash) over the tools of the language's checks (`nuclearlang/tools/node`,
  `nuclearlang/tools/python/.venv`, dart).

## Commands

From the root of the tree:

```sh
nuclear-synapsis-framework/lodash/check.sh            # build for the three dialects, their checkers, every test
nuclear-synapsis-framework/lodash/check.sh array      # one test file
UPDATE=1 nuclear-synapsis-framework/lodash/check.sh   # the TypeScript output becomes the expected one: read it first
nuclear fmt nuclear-synapsis-framework/lodash         # the canonical layout (a cargo test holds it)
```

## Folders

- `src/array.nuc`, `collection.nuc`, `math.nuc`, `string.nuc`, `object.nuc`, `function.nuc`: one file per category
  of lodash. Every function has its doc comment.
- `test/<category>_test.nuc`: a `main()` that prints one line per case (`ok <name>`, or what it got and what was
  wanted); `test/<category>.out` is that text. `test/support.nuc`: `check` and what the tests share.
- `check.sh`: twice (`library`: `src/` and `test/` built together; `native`: `test/` alone, every helper brought by
  the compiler), copies the project per dialect, builds it, runs `tsc --strict`, `dart analyze --fatal-warnings` and
  pyright over the whole library, runs each test in the three targets and compares it with its `.out`.
- `docs/`: the documents below.

## Rules

1. **lodash is adapted to Nuclear, never Nuclear to lodash** (the user, 2026-11-21). A function is here when it
   serves Nuclear code; one that only makes sense in JavaScript (the `arguments` object, prototypes, type coercion,
   a class compared with another, a `this` binding) is not written.
2. **What the language's library has is not repeated**: `map`, `filter`, `find`, `take`, `unique`, `groupBy`,
   `trim`... are members of Nuclear's types (`nuclear help library`). `docs/07-reference/functions.md` says which
   member each lodash name is.
3. **Typed.** A helper names its parameters and their types; an iteratee is a lambda, never a text or a pattern
   object; several lists are given as their own parameters, since Nuclear has no rest parameter. Only the helpers
   of paths (`get`, `set`, `has`, `unset`, `merge`, `cloneDeep`) take `any`, over maps and lists.
4. **The same in every dialect.** A case is done when it prints the same in TypeScript, Dart and Python with no
   warning of the target's checker. A difference between the targets is a bug of the compiler or of a dialect:
   it is fixed there (`nuclearlang/`), with its test, never worked around here.
5. **A case states what it wants** (`check(name, got, want)`), taken from lodash's own tests and documentation
   where they apply. A random helper takes its source of numbers as a parameter, so its cases are fixed.
6. No target code, no dialect named in `src/` (root rules 3 and 13).
7. **A new helper is a new name of the language**: it is listed in `nuclearlang/docs/07-reference/library.md` §13
   and in `docs/07-reference/functions.md` in the same change; a function only the helpers use is added to
   `INTERNAL` of `nuclearlang/crates/nuclear-transpile/src/helpers.rs`.
8. Done = `check.sh` (both passes) and the language's checks green, these documents and the roadmap current.

## Documents

| Read | When |
|---|---|
| [docs/07-reference/functions.md](docs/07-reference/functions.md) | You need what the library has, the lodash name of each, and what is left out and why |
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is pending: the functions left, the editors |
| [`nuclearlang/docs/03-adr/0013-helpers-are-part-of-the-language.md`](../../nuclearlang/docs/03-adr/0013-helpers-are-part-of-the-language.md) | You need why and how the helpers reach a program |
| [`nuclearlang/docs/05-standards/testing.md`](../../nuclearlang/docs/05-standards/testing.md) | You change the compiler: this library is one of the suites every change runs |
