---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/dart.md, flutter.md, dependencies.md]
---
# The `dart` dialect: how the base language is written in Dart

`dart` is a language dialect: it extends no other, so it defines every `[syntax]` template. `flutter`
([flutter.md](flutter.md)) extends it. The normative equivalences, construct by construct, are
[../07-reference/dart.md](../07-reference/dart.md); this document says where each thing is decided and why. The
meaning of every option and template variable: `nuclear spec` and
[the dialect format](../../../../docs/07-reference/dialects.md).

## Files

| File | Holds |
|---|---|
| `dialect.toml` | `[dialect]` (extension `dart`, indent of 2 spaces, `defs = ["dart@3.13.5"]`), `[options]`, `[syntax]`, `[types]`, `[operators]`, `[functions]`, `[names]`, `[modifiers]`, `[clauses]`, `[use]`, `[kinds.*]`, `[exports]`, `[auto_imports]`, `[project]`, `[docs]`, `[imports]` |
| `keywords.toml` | Dart's reserved words, each with how Nuclear produces it and a note. Inherited by `flutter` |
| `library.toml` | one template per member of Nuclear's standard library; a `helper` is written once per file |
| `docs.toml` | `[kinds]` and `[words]`: the editor's text for each kind and header word. Skipped by the loader |
| `templates/extension.tpl`, `mixin.tpl`, `data.tpl` | the three kinds of this dialect |
| `templates/doc_comment.tpl` | a doc comment as `///` lines, with `@Deprecated(...)` |

## Header words this dialect adds

- Kinds: `extension Name on Type` → `extension Name on Type { ... }`; `mixin Name on Type` → `mixin`; `data Name` +
  fields → an immutable class with a `const` constructor of named parameters, `copyWith` and `toJson`.
- Modifiers: `abstract`, `static`, `late`, `final`, `const`, `sealed`, `base`, `external`, `factory`, `covariant`,
  `get`, `set`. `get` and `set` go between the type and the name (`Color get color`); a setter never returns.
- Clause `with`: `Bird: Animal with Flyer` → `class Bird extends Animal with Flyer`.
- `use` clauses: `show`, `hide`, `deferred`.

## Options and what each is for

| Option | Effect in the output |
|---|---|
| `implicit_self = true` | members are used without `this.` |
| `named_args = "native"` | `f(x = 1)` → `f(x: 1)` |
| `declare_ctor_fields` | `User(name: string)` → `String name;` and `User(this.name);` |
| `const_collection_defaults` | a list or map as a parameter default is `const []`, `const {}` |
| `optional_params_nullable` | `name?: string` → `String? name` |
| `omit_null_default` | `String? data = null` → `String? data` (no lint warning) |
| `interp_bare_names` | `'${name}'` → `'$name'` when the name is not followed by letters (no lint warning) |
| `binary_literals = false` | `0b1010` → `0xa`: Dart has no binary literals |
| `string_quote = "'"`, `dollar_escape = "always"` | text in single quotes |
| `reserved_escape = "suffix"` | a Nuclear name that is a Dart word gets a suffix |
| `max_bases = 1` | a single base; interfaces go with `>` or are detected, also the SDK's `interface class`es |
| `toplevel_statements = "main"` | loose statements go inside a generated `void main()`; a variable a declaration uses stays top-level |
| `super_in_initializer` | `super(x)` at the start of a constructor → the initializer list (`Bird(this.wings) : super('bird')`); when it passes the inherited parameters as they are and in order, super parameters (`Dog(super.name, this.breed)`) |
| `implicit_base = "Object"` | every class extends `Object`: `toString()` gets `@override` |
| `catch_var = "error"` | the variable of a `catch` without a name |

## Declarations

- A name that is not reassigned is `final`; one that is, `var`.
- A method that overrides one of a base or of an interface gets `@override`; the bases are those of the file and
  those of the type definitions (the SDK's classes).
- A `PascalCase` decorator without arguments names a class, so its const constructor is called (`@DateConverter` →
  `@DateConverter()`); a `camelCase` one stays as it is.
- A function with `~` is `async` and returns `Future<T>`; with `yield`, `sync*` and `Iterable<T>` (`async*` and
  `Stream<T>` with both).
- `{}` in a signature are named parameters (`{required String name}`).

## Expressions that are not one-to-one

| Nuclear | Dart | Why |
|---|---|---|
| `a ** b` | `pow(a, b)`, plus `.toInt()` when both operands are known integers and `.toDouble()` when one is a decimal | `pow` of `dart:math` returns `num` |
| `a in b` | `b.contains(a)` for a list; `b.containsKey(a)` for a map | |
| range `a..b` as a value | `List.generate(b - a, (i) => a + i)` | |
| `for k, v in m` | `for (final MapEntry(key: k, value: v) in m.entries)` | |
| `print(a, b)` | `print([a, b].join(' '))` | Dart's `print` takes one value |
| `delay(ms)`, `awaitAll(xs)` | `Future<void>.delayed(Duration(milliseconds: ms))`, `Future.wait(xs)` | |
| a union type, a text literal type, a number literal type | `Object`, `String`, `num` | Dart has none |

`number` is `num`; `any`, `dynamic` and `unknown` are `dynamic`; `Bytes` is `Uint8List`, `Regex` is `RegExp`,
`Match` is `RegExpMatch`.

## `Result`

Nuclear's `Result<E, T>` is fpdart's `Either<E, T>` (ADR-lang-0006): `Ok(v)` → `Right(v)`, `Err(e)` → `Left(e)`,
`Ok()` → `Right(null)`. There is no runtime of its own: the app depends on `fpdart`, imported when the code writes
`Either`, `Right` or `Left` (`[auto_imports]` and `[names] written`). Propagation is
`if (r case Left(:final value)) return Left(value);` and the value is read as `(r as Right<E, T>).value`.
`.ok(cb)` / `.error(cb)` are `flatMap` / `orElse` (`map` / `getOrElse` when the callback returns a plain value);
when they only observe, a `map` / `mapLeft` that calls `cb` and returns the value unchanged. `[exports]` lists what
fpdart exports besides those names (`Task`, `Option`, `State`, `Unit`...): a model of a project named like one of
them hides it.

## Imports

- A `use` path is `package:<path>.dart`; another file of a project is `package:<project>/<path>.dart`.
- `use` shortcuts: `async`, `collection`, `convert`, `io`, `math`, `typed_data` → `dart:<name>`.
- Automatic imports come from the type definitions: every public name of `dart:async`, `dart:math`,
  `dart:convert`, `dart:collection`, `dart:io`, `dart:typed_data`, `dart:isolate` and `dart:developer` is imported
  when used. The names of `dart:core` are never imported.
- `[docs]`: the URL of the API reference of an automatic import, for the editor's hover (`api.flutter.dev`).

## The standard library

`library.toml` writes [Nuclear's library](../../../../docs/07-reference/library.md) with Dart's: lists, maps and
sets are Dart's; `DateTime` and `Duration` are Dart's; `xs.map(f)` and `xs.filter(f)` end with `.toList()`;
`find` is `where(f).firstOrNull`. `Error(message)` is a `NuclearError` (an `Exception` with a `message`, written
once per file) and `e.message` is `e.toString()`, which also works for any other thrown object. `reverse` in
place, `min`, `max`, `sortBy`, `groupBy`, `cbrt`, `hypot` and `Bytes.fromHex` are helpers written once per file.
`string.length` counts UTF-16 code units; `chars()` gives the characters. The full account:
[../07-reference/dart.md](../07-reference/dart.md) §5.

## Projects

`[project] sources = "lib"`: in a `nuclear.toml` project the `.nuc` files go to `lib/`, as in a Dart package.
