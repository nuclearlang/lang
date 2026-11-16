---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [emitter-options.md, result.md, dialects.md, type-definitions.md, ../05-standards/testing.md]
---
# The emitter

Read this before any change to the generated code (`crates/nuclear-transpile/src/emit.rs`, `analysis.rs`). The
options a dialect sets and what the targets without braces needed are in [emitter-options.md](emitter-options.md).

## Values and declarations

- `const` or `let` depending on whether the name is reassigned in its block (`analysis::reassigned_after`).
- Block scope (`scoped()`): after an if/for/while/match/try its variables go to `Frame.gone`; reading them
  later is N0105. A camelCase name nothing defines is N0106 (`check_defined`), unless there is a whole-module
  `use` or the module inherits from something declared outside (`ModCtx.open`). Known names: locals, members
  (also inherited from bases in the file and a kind's `members`), declarations, imports, `[names] globals`,
  auto-imports, `[functions]`, base types (`int.parse`).
- `if`/`match` are values: `x = if ...` with multi-line branches → declaration + if that assigns the last
  line of each branch (`Tail::Assign`); one expression per branch → ternary. The last if/match of a function
  with a return type → `return` in each branch (`Tail::Return`). `match` becomes if/else or chained ternaries.
- Implicit return of the last line in functions, methods and block lambdas, except with return type `void`
  and in setters. An assignment as last line returns the created variable. A modifier with `void = true`
  (`set`) never returns.
- Implicit `this` (`implicit_self`); in kinds, `param_access` (e.g. `widget.{{name}}`).
- async is automatic when there is a `~call()`.
- `PascalCase(...)` constructs with the `construct` template; `not_constructors` excludes names.
- Named arguments: `named_args = "native"` uses `named_arg`; otherwise they are reordered by position.
- Reserved words escaped from `dialects/<language>/keywords.toml`.
- In a text enum an item without a value takes its own name.

## Imports

`use` shortcuts, auto-imports by free name and a kind's `imports`. Decided after emitting from the words of
the code (`emit::code_words`: no comments, no string text). A module is not imported if another needed
module re-exports it (`[reexports]`). A file imports an auto-import name only if its generated code writes it
(`written_words`).

## Layout and comments

- `line_width` and `trailing_comma`; "hug" when the only argument is a lambda, object or list.
- Comments stay in place with their blank line. A doc comment goes to the optional `doc_comment` template
  (`Emitter::doc_before`; TS JSDoc, Dart `///` + `@Deprecated(...)`).
- Line map: the emitter writes `\u{E000}offset\u{E001}` markers on statements, members, declarations and
  split arguments (`join_items_at`); `Emitter::file` removes them and fills `Output::lines` /
  `BuiltFile::lines` (ADR-lang-0011). The generated text does not change (golden tests prove it).

## Constructs

- Generic calls `X<T>(...)` (`generics` template), spread (`spread_arg`), `x as T` (`cast`), `x!` (`non_null`).
- `method`/`method_signature` get `mods` (one flag per header word): Dart writes `Color get color` with
  `{{#mods.get}}`.
- Destructuring (`destructure`/`pattern`): `[a, ...r] = xs`, `{ a, "k": b } = m`, `_`; existing names →
  `pattern_assign`; a mix → N0107.
- Generators: `yields_block` → `generator` flag, `generator`/`async_generator` types, no implicit return;
  `yield` / `yield_all`.
- Operators (ADR-lang-0002): `[operators]` templates get `left`/`right` (wrapped), `left_arg`/`right_arg` (bare,
  for calls like Dart's `pow(a, b)`), `left_infix`/`right_infix` (parenthesized only where the operator's
  precedence needs it), `int`/`double` (`num_kind`: literals, typed locals, module fields, function returns) and,
  for `in`, `map` (a `Map` object) / `object` (a map literal or `<K, V>`); for `eq`/`not_eq`, `null` (a side is
  `null`: Python `is None`). A bitwise operand of a comparison gets parentheses (TS binds `==` tighter);
  `-(a ** b)` under unary minus. `is` gets `t` (the type's `tinfo`: TS writes
  `typeof`/`Number.isInteger`/`Array.isArray`). `for_entries` gets `map`. Constructed `Map/Set/List<...>()` locals
  record their type.
- `try` as the last line returns the last line of `try` and `catch` (`try_stmt` with the tail).
- The `try` template gets `catch_used` when the `catch` block names the caught value (`contains_word` over the
  emitted block): Python binds no name otherwise (`except Exception:`).
- Dart top level (`toplevel_main`): statements go in a generated `main`; a variable that a declaration uses
  stays top-level; other statements plus an own `main` → N0113.
- `if` in lists → `list_if`. Cascades → `cascade` + `cascade_self` (Dart "", TS "$"); with
  `options.cascade_statements` (TS) `x = T()..a = 1` becomes declaration + statements.

## The standard library

A member of a base type is rewritten when the receiver's type is known: `static_type` (the receiver's type),
`library_access`, `library_render`, with the dialect's `[library.<base>]` templates; N0114 and N0115 are its
diagnostics. Decision and vocabulary: ADR-lang-0009, `docs/07-reference/library.md`.

## Inheritance

- A method named like a member of a base in the file → `override` (extended bases; TS `override`, Dart
  `@override`) or `override_interface` (interfaces; Dart only). `inherited_members(_known)` walks the bases in
  the file and the dialect's type definitions (`Dialect.defs`). A base found in neither leaves the module
  `open` (no N0106). `options.implicit_base` (Dart: `Object`) makes `toString()` an override. A base with
  `kind = "interface"` in the defs goes to `implements`. Kinds use `inherits = ["State"]`; a kind's `inherits`
  count as bases.
- Constructors of inheriting modules: `super(...)` first in the body; its arguments see the parameters as
  locals. TS: optional `super_call`. Dart: `options.super_in_initializer` moves it to the initializer list and
  `super_param` gives `Dog(super.name, this.breed)`. A parameter named like a base member is not a new field.
- Generic bounds: `generic_param` template.
- Methods of a base from the type definitions that return a Result come from `ClassDef.results` (`index.json`),
  so `x = ~repo.find(id)` unwraps; an error type that extends the function's (`NotFound` of `AppError`,
  `is_subtype`) propagates without N0109.
