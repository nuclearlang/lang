---
status: accepted
owner: Julian Molina
updated: 2026-11-18
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
  and in setters. An assignment as last line returns the created variable; in a function with a written return
  type, also a reassignment or a compound one of a name or an attribute (`count += by` → `return this.count`,
  `assigned_tail`). A modifier with `void = true`
  (`set`) never returns.
- Types the emitter follows for the library and the checks (`static_type`): a module's type parameters
  (`Box("hi")` is a `Box<string>`, from the written ones or from the constructor's arguments, `bind_generics`), the
  return type of a generic function and of a method or attribute of a generic module with them replaced
  (`subst_type`), an optional attribute as nullable, a getter as an attribute, `xs.map((x) => ...)` as a list of what
  the lambda gives, and a variable narrowed inside `if x is T` (the branch only).
- A lambda given for a parameter of a function type takes its parameters' types from it, with the type parameters
  the call fixes replaced (`callee_bound`, `lambda_hints`); in a list of functions it also writes them
  (`item_hints`, `typed_hints`).
- A literal given for `any`, or inside a map or a list of `any`, is written with the dialect's `object_any` /
  `list_any` (`any_level`, `any_literal`); a value declared `any` is shown with `show_any`, a nullable decimal with
  `show_double_nullable`.
- What a method of a module of the program gives and nothing declares (`orders.where(...)`, a query of its base
  class) is not taken for a base type by the name of the next member (`count()`); a class of the type definitions
  keeps the rule of the name (`file.readText().trim()`).
- `obj.method` given as a value: `method_ref`. `call()?.name` where `?.` is not native: `optional_member_once`.
- A block lambda that assigns a variable of the function around it: `Closure` collects the names and the dialect
  writes its `nonlocal_decl` / `global_decl` line first (Python).
- A `[names] written` name the code holds only as a local (`log`, `max`) imports nothing: the times the local was
  written (`local_writes`) are compared with the times the word is in the code.
- Implicit `this` (`implicit_self`); in kinds, `param_access` (e.g. `widget.{{name}}`; it gets the parameter's `default`, written in the target, from `ModCtx.ctor_defaults`).
- async is automatic when there is a `~call()`. `Sig.sync`: a body that awaits and yields nothing, in a kind without
  `async_methods` / `awaitable_methods`; `~` on a call of it is N0224 (`check_not_async`, the mirror of N0222's
  `check_awaited`), unless it returns a `Future`/`Stream`.
- `PascalCase(...)` constructs with the `construct` template; `not_constructors` excludes names.
- Named arguments: `named_args = "native"` uses `named_arg`; otherwise they are reordered by position.
- Named arguments to a callee declared in Nuclear (a function, `Module.method`, a method called without `this`) are
  reordered by its positional parameters in every dialect; a name it lacks is N0219.
- Reserved words escaped from `dialects/<language>/keywords.toml`.
- In a text enum an item without a value takes its own name.

## Imports

`use` shortcuts, auto-imports by free name and a kind's `imports`. Decided after emitting from the words of
the code (`emit::code_words`: no comments, no string text). A module is not imported if another needed
module re-exports it (`[reexports]`). A file imports an auto-import name only if its generated code writes it
(`written_words`).

Lazy imports (ADR-lang-0012: `[project] lazy_imports` and `[syntax] local_import`; `transpile_alone` for a file
alone): each block of a function body (`stmts`, a one-line `match` arm) is written between marker lines
(`lazy_block`; a lambda's body is not marked, a loop's body is flagged, a branching assignment is written as blocks).
`imports` records which names each line binds (`Lazy.lines`); `place_lazy_imports` reads the free words of each
block and of what lies outside every function body, as the top imports do (`free_code_words`), and moves a name
that only bodies use to the deepest block of each function holding its uses, outside any loop; a function with a
local or parameter of that name keeps it at the top. The markers are then taken out.

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
  `typeof`/`Number.isInteger`/`Array.isArray`). `for_entries` gets `map` and `iter_member` (the map wrapped for a member after it: `(env ?? {}).items()`). The
  operand of a spread is wrapped the same way, in a list, a map and a call (`*([b] if c else [])`, `**(x if c else y)`). Constructed `Map/Set/List<...>()` locals
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
diagnostics. A library or `[functions]` template renders each `argN` as a marker first (`fill_args`): an argument that
is not atomic gets parentheses wherever the template puts it next to an operator, a member or a call
(`{{recv}} * {{arg0}}` of `"x".repeat(a + b)` → `"x" * (a + b)`), and stays bare between delimiters (`f({{arg0}})`). Decision and vocabulary: ADR-lang-0009, `docs/07-reference/library.md`.

A map read `m[k]` uses the dialect's `index` template with the `map` flag (a lookup that gives `null` for an
absent key, in a dialect whose index throws) when `map_kind` knows the object is a map: a typed local or field, or
what `static_type` says any other expression gives: a function, a static method of a class of the project or of
the type definitions (`Paths.machine()["k"]`), a member.

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

## The monitor

A project built with `--monitor` (`Manifest.monitor`, set by the CLI; spec 015 of the platform) measures each
function and method of its `.nuc`: `Emitter::monitored` renders the dialect's `monitor_body` around the body before
the `function` or `method` template sees it, so every kind's own method template gets it too. Its `label` is the
Nuclear name (`ProjectCtx.source_names` undoes the dialect's renaming), `path` and `line` the place in the `.nuc`.
A file that measures imports `NuclearMonitor` from `nuclear/monitor` (`MONITOR_PATH`), which `project::build`
writes once from `monitor_runtime`, as it does the `Result` runtime. Generators, empty bodies, files built alone and
dialects without the two templates are left as they are: without `--monitor` the output does not change (the
goldens). Test: `the_monitor_measures_each_function_only_when_asked` (`tests/projects.rs`).
