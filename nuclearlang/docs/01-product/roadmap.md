---
status: accepted
owner: Julian Molina
updated: 2026-11-18
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

- **`nuclear check` lets wrong types through** (found writing the skills library, 2026-11-18): an undeclared type of a field, and `x: int = "s"`, report no diagnostic.
- **A method's argument loses its parentheses** (found by Nuclear Builder's MCP tools, 2026-11-18): `"x".repeat(a + b)`
  is written `"x" * a + b` in Python, a wrong value with no diagnostic. Wanted: the operand of an emitted operator
  parenthesized when it is not atomic. Worked around in `extensions/tools/nuclear-builder/tests/test_tools.nuc`.
- **No lazy import** (found by Nuclear Builder's start-up, 2026-11-18): `use` is only at the top of a file and a
  project's names are imported at the top too, so a command line program loads every library of every command (the
  `mcp` library alone is 300 ms of `nuclear-builder`'s 530 ms). Wanted: a `use` inside a function (Python: a local
  `import`; TypeScript: `await import`; Dart: `deferred as`), or a project name the dialect imports where it is used.
  Worked around in `extensions/tools/nuclear-builder/cli.nuc` (`lazy`: `importlib.importModule` of the module).

### Found in the restructure (spec 008)

- `docs/07-reference/projects.md` §1.2 says only a url contract keeps `contracts/<name>/contract.json`; the code
  writes it for a path contract too.

### Found by a corpus checked in the three targets (2026-11-17)

The cases that broke a target are fixed and kept in `examples/semantics/` (`DIR=examples/semantics
tools/stdlib-check.sh`). Left:

- **Known by its type only**: `==` compares what two lists hold when one side is known to be a list, a map or a set
  (`any` is compared as the target does); TypeScript prints a decimal with its `.0` when it is known to be one (a
  decimal literal, a division, a value declared `double`): a field read through a `match ... is Type ->` narrowing
  (`"${s.side}"`) and a library call (`Math.min(3.0, 9.0)`) still print `2` / `3`.
- `docs/08-guides/create-a-dialect-with-an-agent.md` is checked against `typescript` by `spec-check`, but its example
  is the `handler` kind of the dialect the guide makes: 2 problems that are not the compiler's.
- `tsc --strict` rejects a comparison with a constant it narrowed (`t = true` then `t == false`, TS2367).
- A function's parameter named like a function the dialect writes (`sorted(xs: int[], sorted: int)`) still hides it
  in Python: a parameter keeps its name (it is the API), so only a body that also calls the builtin breaks.
- A constructor's parameter whose default is a list is `const []` in Dart (a function's is nullable and set in the
  body, `default_init`).

### Found by running the same programs in the three targets (2026-11-17)

Each passes `nuclear check`. The plan is [spec 010](../../../docs/04-specs/010-migration-into-nuclear/design.md)
("The catalogue"); each case becomes a program of `examples/semantics/` when its rule is decided and fixed.

**The same program gives another value, with no error:**
- **Conditions that are not booleans** pass `nuclear check`: `if xs` with an empty list is true in TypeScript and
  false in Python (Dart does not compile); `s or "d"` is a value in TypeScript and Python.
- **`==` and `in` of `any`**: `[1] == [1]` and two equal maps are `true` in Python, `false` in TypeScript and Dart;
  `1 == true` is `true` in Python. `[1] in [[1]]` and `xs.indexOf([1])` compare by content only in Python; `nan in
  [nan]` is `false` in Dart. `true in [1, 2]` passes the check and is `true` in Python.
- **TypeScript maps are objects**: keys that look like integers come first (`{ "b", "2" }` iterates `2, b`, also
  `groupBy`); an `<int, V>` gives its keys as texts (`k + 1` is `"11"`, `k == 1` is `false`); `"toString" in m` is
  `true` and `m["toString"]` is not `null`; a `"__proto__"` key is not stored.
- **Python does not start an async call until it is awaited**: `f = work()` then other code runs `work` later.
- **Python sets are not in insertion order** (`Set.of([3, 1, 2]).toList()`).
- **Integers**: above 2^53 TypeScript rounds (`9007199254740993`); past 64 bits Dart wraps, Python grows, TypeScript
  rounds; `2 ** 64` is `0` and `2 ** -1` is `0` in Dart. `-1 >>> 1` differs between Dart and Python.
- **Decimals as text**: `1e-7` is `1e-07` in Python; `1e16` and `1.2e20` are written three ways; infinity is
  `inf` in Python; `-0.0` is `0.0` in TypeScript; `1.0.toString()`, `join`, `sorted().join` and `Json.encode` lose
  the `.0` in TypeScript; `h: double = 3` keeps an integer in Python (prints `3`).
- **Types**: `1.0 is int` is `true` in TypeScript; a `number` holding `2` `is double` in TypeScript.
- **Texts outside the BMP**: `length`, `s[i]`, `codeAt` and `<` count code points in Python (the library says code
  units). `"straße".upper()` keeps `ß` in Dart; `"İ".lower()` has another length in Dart.
- **Parsing**: `"0x1f".toInt()` is `31` in Dart; `"1_000"`, `"١٢"`, `"1_0.5"` are numbers in Python; `"inf"` and
  `"NaN"` are decimals in Python and Dart; a 20-digit `toInt()` rounds in TypeScript and is `null` in Dart.
- `padEnd(3, "ab")`: `xab` in TypeScript, `xabab` in Dart, an error in Python.

**One target fails where another goes on:**
- Out of range: `xs[10]`, `xs.first` on an empty list and `m["x"]!` give `undefined`/`NaN` in TypeScript (no error)
  and throw in Dart and Python; `xs[-1]` is the last element in Python; `substring(3, 1)`, `substring(1, 99)` and
  `slice(-1)` throw in Dart and are clamped elsewhere.
- Zero: `1.0 / 0.0` and `0.0 / 0.0` throw in Python; `1 ~/ 0` is `Infinity` in TypeScript; `1 % 0` is `NaN` in
  TypeScript.
- Python stops at about 1000 nested calls; `"abc".split("")` and a set of lists are errors in Python.

**The generated code does not compile:**
- Dart: `"${true}"` / `"${null}"` are written `$true` / `$null`; `"a" < "b"` (no `<` on `String`); `sum()` of a
  `double[]` (`fold(0, ...)`).
- `Set<int>.add(1.0)` and `true in [1, 2]` pass `nuclear check` and fail `tsc` / Dart.
- `a is b` with a variable `b` passes the check and fails in every target.
- `Dog(name: string) : Animal(name)` passes the check and calls the base without its argument.
- TypeScript (TS2367): an enum value compared with another (`Color.red == Color.green`), a `match` on a constant.

**Porting code into Nuclear:** TypeScript's `==` coerces (`"1" == 1`) and is valid Nuclear, so it is not flagged
the way `===` is (N0009); Python's `a is b` is identity and Nuclear's `is` is a type; Python's `==` of a dataclass
and Dart's `operator ==` compare fields, Nuclear's `==` of two modules compares the object.

### Found writing Nuclear Builder's set-up (2026-11-17)

- **No tuple for a target's API that takes one**: Python's `socket.bind(("127.0.0.1", port))` cannot be written;
  `extensions/tools/nuclear-builder/setup.nuc` passes `socket.getaddrinfo(...)[0][4]` (the pair the system gives).
- **A function type with a parameter without a name** (`onPick: (int) => void`) is written in TypeScript as
  `(int) => void`, a parameter named `int` of type `any` (`tsc --noEmit` of the website: TS7006 in
  `module_panel.ts`). Wanted: `(arg0: number) => void`, or the name made required with a fix.
- **No alias of a function type**: `Say = (line: string) => void` is a lambda, so `(line: string) => void` is written
  at every parameter.

### Found writing the software factory's engine (spec 011, 2026-11-17)

- **The result of a call of a function-typed parameter has no type**: in `apiLoop(ask: (...) => ModelTurn, ...)`,
  `turn = ask(...)` then `turn.text.length` is written `turn.text.length` in Python (not `len(...)`); the
  workaround is `turn: ModelTurn = ask(...)`. Wanted: the call's type is the function type's return type.
- **Three names in a `for`** (`for dir, dirs, files in os.walk(root)`) are N0013: only `for k, v in map`. Workaround:
  one name and `entry[0]`, `entry[1]`, `entry[2]`.
- **Some values lose their type, so a member is written as it is** (`x.isEmpty`, `x.length`, `m.keys` in Python):
  the result of a module's method that returns a class of another file of the project (`out = provider(...)` in
  `factory.nuc`, then `out.documents.keys`); the parameter of a lambda over the result of `map` with an
  interpolated string (`xs.map((r) => "${r["model"]}").filter((m) => m.length > 0)`); the value of a ternary
  with a library call (`existing = f.isFile() ? f.readText() : ""`). pyright finds each; the workaround is a type
  on the name. Wanted: the types carried through.
- **`m[k]` of a value of type `any`, and `m![k]`, are Python's subscript** (`KeyError` when the key is missing),
  where `m[k]` of a typed map is `m.get(k)` (`null`): `own["team"]` of a JSON object read as `any` raised instead of
  giving `null`. Workaround: the value given a map type first (`own: <string, any> = found`). Wanted: one meaning,
  `null` when absent. Also a typed map whose values are not nullable, indexed by a plain name or a call
  (`ADAPTERS[provider] == null` in Nuclear Builder's `chat.nuc`, where `ADAPTERS["${p}"]` is `.get`): Python's
  subscript, `KeyError`. Workaround: `key in map` first.
- **An inherited attribute has no type in the subclass** (2026-11-18): in `Member: Chat`, `history.length` of Chat's
  `history: <string, any>[]` is written `self.history.length` in Python (and `isEmpty` as `is_empty`). Workaround: a
  typed name first (`kept: <string, any>[] = history`, in Nuclear Builder's `member.nuc`). Wanted: a module's
  attributes known in the modules that extend it. Worse, a local name in a method of the subclass that is an
  inherited attribute's name (`given = …` in `Member`, Chat's `given`) is written `self.given = …`: it overwrites
  the attribute (pyright caught it as an error). Wanted: a local is a local, or N-code for the clash.
- **`try` is not a value in the middle of a block** (`raw = try ... catch e ...`): only as the last line of a
  function. Workaround: a helper function whose last line is the `try`.

### Found writing Nuclear Chat's service (spec 013, 2026-11-18)

- **An appcomponent alias's `Result` does not propagate**: inside a use case returning `Result`,
  `ws = workspaces.workspace(id)` (an alias of another component's use case) keeps the `Result` (N0114 then says
  `ws.value.id`), where a method written in Nuclear with that return type unwraps it. Workaround: a typed
  `Result` and `if found.isErr` + `return Err(found.error)`, marked `shortcut:` in `nuclear-chat/nuclear_chat/`.
  Wanted: aliases propagate like the method they name.
- **`~` on a call that is not async is written `await`** (fastapi): `~workspaces.register(input)`, whose use case
  awaits nothing, is `await self.workspaces.register(input)`, a `TypeError` when it runs; `nuclear check` says
  nothing (pyright does). Wanted: a diagnostic, or no `await`.
- **A block lambda given where `(…) => Future<void>` is expected**: it is async only when it holds a `~`, and its
  last line is returned (`told = ~emit(…)` then `told.isOk` makes it return a `bool`). Workaround: a `~` inside and
  an `if` as the last statement. Wanted: the expected type decides both.
- **A one-line lambda loses its parameters' types** in Python (`(channel: string, text: string) => …` is
  `lambda channel, text: …`): pyright strict reports it partially unknown. Also the value of a library call with no
  declared type (`given = os.environ.get(…)`, then `given!.isEmpty` is written `.is_empty`) and the parameter of a
  lambda over `map(…)` (`.map((l) => l.trim()).filter((l) => not l.isEmpty)`), as above. Workaround: a type on the
  name or the parameter.
- **`m![k] ?? x` of a map is Python's subscript** (`KeyError`), as `m[k]` of `any` above: found folding a thread's
  reply count. Workaround: a typed name first (`root: <string, any> = opened!`).

### Found building Nuclear Chat's UI (spec 013, 2026-11-18)

- **An appcomponent alias's `Result`** (above, found in the service): typed `all: Message[] = ~messages.history(…)`
  is accepted and written as an assignment of the `Result` (only `tsc` catches it); and a named argument to an
  alias (`searchGifs(workspace, q = q)`) is written as an object (`{ q }`) where the use case takes it positionally.
- **A test's top-level function can be imported by the app**: `project.rs` puts a `test/` file in `synapsis.g.ts`'s
  imports when a name it declares is "written" elsewhere (a helper `channel(...)` in `test/chat_test.nuc`), and
  vitest lands in the embedded bundle (it then fails at load: `lr.config`). Wanted: `test/` never imported by the
  app.

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
