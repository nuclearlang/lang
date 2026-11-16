---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../04-specs/README.md, ../02-architecture/limits.md]
---
# Roadmap

The pending work of the language, the compiler and the language server. A done item is deleted.

## Half done

- **The language to 1.0** ([spec 005](../04-specs/005-language-1-0/plan.md)): `nuclear fmt` is done (only reflow).
  Left: TypeScript type definitions, member types in the definitions, named and factory constructors, patterns in
  lambdas, `for` and `match`, `const` inference; then the 1.0 spec is frozen.

## Untested

- The examples in the `docs.toml` files parse: checked once by hand; no test guards it.
- ADR-lang-0010 with agents: N0022, N0219, N0220 and `nuclear help words` are not measured (F7 of
  `../tools/cli/docs/04-specs/001-agent-support/plan.md`).
- Packages of the target (ADR-lang-0008): Windows and macOS (the `package_*` commands), pyright over a project
  with packages, a web screen that uses one.

## To decide with the user

- A quick fix for N0217 (`data.fix` in the diagnostic; the language server would already apply it): offered, no
  answer.
- Diagnostics of the closed files of a project in the editor: only if the user asks.

## Pending

### Found building the website (2026-11-16)

- **An arrow passed where a `void` callback is expected passes `nuclear check` and fails `tsc`**: `inView(".x",
  (element) => animate(element, ...))` (motion) returns a value where the definition says `void |
  ViewChangeHandler`; the call has to go through a method that returns `void`. The check of a lambda's value against
  a callback type of the definitions is missing.

### Language and compiler

Found while writing `nuclear-graph` in Nuclear with the `python` dialect; each cost a wrong program that
`nuclear check` accepted, or a detour:

- **Silent — a top-level value** of a file is not visible to the other files of a project (it is exported through
  a function), and an UPPER_CASE name nothing defines is not reported.
- **Silent — a library member on a receiver whose type is not known** is written as it is (`x.length`) or rewritten
  as if it were a list (`collection.count()` → `sum(1 for ...)`, `replace`; `matrix.sum(axis = 1)` of an `any` →
  `sum(matrix)`, its named argument dropped); an untyped map is indexed as it is instead of with `.get`.
- **Silent — a constructor parameter is an attribute**, so a local of the same name writes the instance's state.
- **Silent —** `xs.findIndex((i) => ...)` writes `for i, i in enumerate`.
- **Silent —** a spread of a parenthesised expression loses its parentheses (`[a, ...(c ? x : y)]`).
- **Silent —** a local named like a function of another file imports that function (a cycle).
- **Silent —** a typed top-level value (`PORT: int = 1`) is written as a class.
- **Silent —** a module with only typed attributes that extends a library class (`X: BaseModel` +
  `roots: string[]`) is written as a Protocol.
- **Silent —** `list` as a method's name captures the builtin inside its class.
- **Not parsed:** `any[] ? a : b` and a map literal inside a ternary; a back-tick or `#` inside a text nested in an
  interpolation (N0022).
- **Missing:** `assert` (tests use `expect()`); a regex that matches across lines (no `dotAll`).
- **Reserved words that read as names:** `match`, `use`, `final`.

Other findings:

- **`~` before a call that is not asynchronous compiles and fails in Python** (found with `gen usecase`). A use
  case whose `exec` has no `~` is synchronous, so is its facade alias, and a controller that writes
  `~app.tidyTitle(title)` is emitted `await self.app.tidy_title(title)`: pyright says `"Result[AppError, str]" is
  not awaitable` and at run time it is `TypeError: 'Result' object can't be awaited` (TypeScript and Dart only await
  a plain value). The compiler knows the callee is synchronous (`Sig.is_async`): the mirror of N0222 is missing, a
  diagnostic with the fix "remove `~`" (a new code, `docs/07-reference/diagnostics.md`,
  `crates/nuclear-transpile/tests/rules.rs`). `gen usecase` already writes `~` only when the use case awaits;
  hand-written and agent-written code is not guarded.
- **`Name<T>.member(...)` does not parse** (`Set<int>.of`, `List<int>.filled`): a generic type before a member;
  today `s: Set<int> = Set.of(...)`. Clean support needs an additive AST node for a generic receiver (for example
  `ExprKind::GenericName { name, type_args }`, since `Call`'s `type_args` go after the method for `obj.m<T>()`),
  which touches `ast.rs` and every exhaustive `ExprKind` match in `crates/nuclear-transpile` and the language
  server. Deferred as disproportionate for a niche case with a working annotation.
- **Type definitions carry no member types:** a value returned by a library method is untyped, so a library member
  on it (`path.length` of `~toolchain.pathOf(...)`) is written as it is (wrong in Python) until the value is typed
  (`path: string = ...`).
- **Packages of the target** (ADR-lang-0008), left: no `add` for a `nuclear.toml` project; the members of a
  CommonJS `export =` value are not names (`lodash.chunk`, not `chunk`); a package with no types nor `@types` is not
  described; `x.random(8)` writes `import random` (a written word that is an `[auto_imports]` module); a declaration
  named like a word of the target is a file nothing can import (`Try` → `try.py`).
- **`nuclear fmt` limits:** only reflow, it does not add trailing commas or wrap long lines. The two external
  projects (`rick_and_morty`, `nuclear_langgraph_agent`) are not formatted yet (only `--check` was run: 5 or more
  files would change in `rick_and_morty`, no errors): run `nuclear fmt .` there when the user wants.
- Components per principle 6 of the base · `const` inference in Dart · TypeScript type definitions (a generator
  from `.d.ts`). What is not expressible yet: [limits.md](../02-architecture/limits.md).
- Dialects created by agents ([spec 002](../04-specs/002-dialects-with-agents/plan.md), D1–D7): not started.
- Postponed by the user: everything Node.js/Express. Do not touch it until asked.

### Language server

- **Format on save:** LSP `textDocument/formatting` over `nuclear_syntax::fmt::format`; the document stays
  unchanged when it returns `Err`.
- **Types** of chained expressions (`a.b.`, `~dio.get(url).`, `Theme.of(context).textTheme.`), of calls
  (`inject<X>().`, `Text("a").`) and of pattern variables (`Ok(c) -> c.`); generics substituted in the signatures
  shown (`onChange(change: Change<State>)` in a `Cubit<int>`); with unsaved changes there are no architecture rules
  nor kind by folder.
- **Open requests to the compiler crates** (optional): (a) `project::build` with the text of the open files
  (`overrides: &HashMap<PathBuf, String>`); (b) public `default_kind` and `ProjectCtx::visible`; (c) the inferred
  type of an expression; (d) `render_member` substituting generics.
