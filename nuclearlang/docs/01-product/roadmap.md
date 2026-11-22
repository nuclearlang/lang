---
status: accepted
owner: Julian Molina
updated: 2026-11-21
related: [../04-specs/README.md, ../02-architecture/limits.md]
---
# Roadmap

The pending work of the language, the compiler and the language server. A done item is deleted.

## Half done

- **The language to 1.0** ([spec 005](../04-specs/005-language-1-0/plan.md)): `nuclear fmt` is done (only reflow).
  Left: TypeScript type definitions, member types in the definitions, named and factory constructors, patterns in
  lambdas, `for` and `match`, `const` inference; then the 1.0 spec is frozen.

- **A `match` assigned to an index** (python dialect): `found[key] = match v …` is emitted as `found.get(key) = …`, a
  syntax error of the generated Python that `nuclear check` does not report (found by Nuclear Builder's `metrics.nuc`,
  which names the match first). Left: emit the index's assignment, and a golden test. Not reproduced in a small file:
  `found[v] = match v` (string arms, calls in the arms, `+=`, `? :`, `if`/`else`) is emitted as an index assignment
  with a ternary in python, typescript and dart; the next step is to build `metrics.nuc` with the workaround removed
  and find what makes the match lower into statements there.
- **Dart: `+=` on a map's entry with a ternary** (`found[v] += c ? 1 : 2`) is emitted as
  `found.update(v, (v) => v + c ? 1 : 2)`: the lambda's parameter shadows the key and the value is not parenthesized.

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
  and throw in Dart and Python; `xs[-1]` is the last element in Python.
- Zero: `1.0 / 0.0` and `0.0 / 0.0` throw in Python; `1 ~/ 0` is `Infinity` in TypeScript; `1 % 0` is `NaN` in
  TypeScript.
- Python stops at about 1000 nested calls; `"abc".split("")` and a set of lists are errors in Python.

**The generated code does not compile:**
- `Set<int>.add(1.0)` and `true in [1, 2]` pass `nuclear check` and fail `tsc` / Dart.
- `a is b` with a variable `b` passes the check and fails in every target.
- `Dog(name: string) : Animal(name)` passes the check and calls the base without its argument.
- TypeScript (TS2367): an enum value compared with another (`Color.red == Color.green`), a `match` on a constant.

**Porting code into Nuclear:** TypeScript's `==` coerces (`"1" == 1`) and is valid Nuclear, so it is not flagged
the way `===` is (N0009); Python's `a is b` is identity and Nuclear's `is` is a type; Python's `==` of a dataclass
and Dart's `operator ==` compare fields, Nuclear's `==` of two modules compares the object.

### Found by the conformance programs (2026-11-21)

Fixed and kept as cases of `examples/conformance/` and tests of `rules.rs`. Left, each passes `nuclear check`:

- **A function named like a base type** (`int(n: int) int`) is written as it is: the type is hidden in TypeScript and
  Dart, which stop compiling. Wanted: a diagnostic, as a reserved word has.
- **A spread argument to a function without a rest parameter** (`add(...args)`) is not Dart (no spread in a call)
  and is rejected by `tsc --strict` (TS2556); Python runs it. Nuclear declares no rest parameter.
- **A map with a type parameter as its key** (`entries: <K, V> = {}` in `Cache<K, V>`) is `Record<K, V>` in
  TypeScript, which wants `K extends string | number | symbol` (TS2344).
- **Dart promotes after a `!`**: `u!.name` then `u!.address` on a local warns `unnecessary_non_null_assertion` on
  the second one, and TypeScript needs both. The same for `(x as Dog).breed` inside `if x is Dog`
  (`unnecessary_cast`); there `x.breed` is enough since the branch narrows `x`.
- **A comparison the target can decide by itself** fails its checker: two different literals compared in TypeScript
  (TS2367, also a constant narrowed by its declaration), a condition Dart knows (`dead_code`,
  `unnecessary_type_check`). The conformance programs read their values at run time for this reason.
- `x **= 2` and `x ~/= 2` are not in the grammar (`x = x ** 2`).

### The helpers of the language (ADR-lang-0013, 2026-11-22)

- The language server does not complete, document nor go to a helper (`chunk`, `uniqBy`...): it reads the
  declarations of a file and of its project, and the helpers are the compiler's. Wanted: their names and doc
  comments from `helpers.rs` in completion and hover.
- A helper is not brought inside a module that extends a class nothing describes, nor in a file with a whole-module
  `use`: a free name there is taken for the other's.
- A file that uses a helper is emitted twice (once to find the names nothing defines): measured as nothing on the
  examples, not on a large project.

### Found writing the library of helpers (2026-11-21)

Fixed, each with its test in `rules.rs` and its cases in `nuclear-synapsis-framework/lodash/test/`. Left:

- **A lambda whose parameter is a type parameter another function argument fixes** is not inferred by Dart
  (`memoize(size, (text) => text[0])`: `text` is `Object?`); the compiler writes the lambda's types only inside a
  list of functions. Wanted: the type of a local lambda (`size = (text: string) ...`) known to `static_type`, so
  the parameter is written with it.
- **`x!` of a missing value** throws in Dart and Python and is `undefined` in TypeScript, which goes on.
- **`find()?.a.b()`** (a chain after a `?.` on a call) still makes the call twice in Python; only `find()?.a` makes
  it once.
- **A literal given for `any` is typed `any` in Dart only inside the value** (`m: <string, any> = { "a": [1] }`
  holds a `<dynamic>[1]`); a list built elsewhere and stored later keeps its own type, so adding another kind of
  value to it fails in Dart alone.

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
- **`try` is not a value in the middle of a block** (`raw = try ... catch e ...`): only as the last line of a
  function. Workaround: a helper function whose last line is the `try`.

### Found writing Nuclear Chat's service (spec 013, 2026-11-18)

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

- **A named argument to an appcomponent's alias** (`searchGifs(workspace, q = q)`) is written as an object
  (`{ q }`) where the use case takes it positionally.
- **A `Result` a lambda or a method without a written return type gives back is not checked where its caller drops
  it** (found handling every Result of the chat, 2026-11-19): `onClick = () => ChannelsManager.change(…)` returns
  the `Result` to a callback that ignores it, and `react()` whose last line is a `Result` call gives it to a caller
  that sees no type. A `Result` is always handled (nuclear-base §3.2): wanted, N0108 where the expected type of the
  callback is `void` and where an untyped method's last line is a `Result`; also a variable typed `Result` that is
  never read.
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
