---
status: draft
owner: Julian Molina
updated: 2026-11-17
related: [requirements.md, tasks.md]
---
# Spec 010 — Design

## The pipeline

```
original project ──nuclear port──► .nuc files + .nuclear/port/points.json   (source points: the original's meaning)
                                         │
                       nuclear check --portability                           (target points: the .nuc's meaning)
                                         │
                       points.json ──► agent (one slice per point) ──► answer ──► nuclear check ──► applied
                                         │
                       the original's tests  vs  the Nuclear project's tests (every dialect of the platform)
```

## The catalogue

What each case found becomes. **Equal**: the transpiler makes every dialect give the same result. **Diagnostic**: the
compiler rejects it with a fix; a migration point when it comes from `nuclear port`. **Point**: neither is possible
without the original's intent; listed for the agent.

| Case | Becomes | How |
|---|---|---|
| A condition that is not a boolean (`if xs`, `s or "d"`) | Diagnostic | `if xs.isEmpty`, `s ?? "d"`; a point when ported from TypeScript/Python truthiness |
| `==` / `!=` / `in` / `indexOf` of a value typed `any` | Diagnostic | a type on the value; the deep helper where the type is a list, map or set |
| `[1] in [[1]]`, `indexOf([1])` with known types | Equal | the dialect's deep helper, as `==` |
| `1 == true`, `true in [1, 2]` | Diagnostic | types that do not overlap |
| TypeScript maps as objects (key order, `<int, V>` keys as texts, `"toString" in m`, `"__proto__"`) | Equal | a `Map` in TypeScript (decided per dialect: `[types]` of the dialect) |
| Python's async call that starts when awaited | Equal | the dialect starts the task at the call (`asyncio.ensure_future`) when the value is not awaited on the same line |
| Python set order | Equal | an ordered set in the Python dialect |
| Decimals as text (`1e-07`, `inf`, `-0.0`, `1e16`, the `.0` lost in TypeScript's `toString`, `join`, `Json.encode`) | Equal | one formatting rule in `library.md` §12, a helper only where the type is a decimal |
| `h: double = 3` keeping an integer in Python | Equal | the dialect writes `3.0` |
| `1.0 is int`, `number is double` in TypeScript | Diagnostic | `is int` / `is double` only on `number`/`any`, with `Number.isInteger` semantics stated |
| Texts outside the BMP (`length`, `s[i]`, `codeAt`, `<` in Python) | Equal | code units in every dialect (the library's rule), Python's helper |
| `upper`/`lower` of `ß`, `İ` in Dart | Equal | the rule names the Unicode mapping; Dart's helper |
| `toInt`/`toDouble` of `0x1f`, `1_000`, `١٢`, `inf`, `NaN`, 20 digits | Equal | one grammar for a number in a text, in `library.md` §1 |
| `padEnd(3, "ab")` | Equal | the rule says how a fill longer than one is cut |
| Out of range (`xs[10]`, `.first` empty, `m[k]!` null, `xs[-1]`, `substring`/`slice` past the end) | Equal | an error in every dialect (TypeScript checks; Python rejects `-1`), clamping where the library says so |
| Division by zero (`/`, `~/`, `%`) | Equal | one rule in `nuclear-base.md` §6.1 |
| `%`, integer width, `>>>`, `2 ** 64`, `2 ** -1` | Decision of the user | today "the target's"; Equal costs a helper on every integer operation in TypeScript |
| Deep recursion (Python's limit) | Point | the call graph shows a recursion; the agent may rewrite it as a loop |
| `"abc".split("")`, a set of lists | Equal / Diagnostic | `chars()`; a set's element type must be hashable |
| Generated code that does not compile (Dart `$true`, `<` of texts, `sum()` of `double[]`, `a is b` with a variable, a base called without its arguments, TS2367) | Fixed | compiler bugs: each one a golden test |

From the original only (`nuclear port`), always points unless the types decide them:

| Original | Point | Candidates |
|---|---|---|
| TypeScript `==` / `!=` (coercing) | when the two types differ or are unknown | `==` (strict), a conversion first (`x.toString() == y`) |
| TypeScript `===` of arrays or objects | always | `==` (content), the same object (no Nuclear form: a point) |
| Python `is` / `is not` | not `None` | `==`, the same object |
| Python `__eq__` / `@dataclass`, Dart `operator ==` | always | an `equals(other)` method, and each `==` of that type replaced |
| A value used as a condition | always | `isEmpty`, `!= 0`, `!= null`, `??` |
| An object used as a map with integer keys (TypeScript) | always | `<int, V>` or `<string, V>` |

## Migration points

`.nuclear/port/points.json`, one entry per point, and the same shape from `nuclear check --portability --json`:

```json
{
  "id": "p12",
  "code": "N0401",
  "rule": "nuclear-base.md §6.2: == of two lists compares what they hold",
  "nuclear": { "file": "src/cart.nuc", "span": [14, 5, 14, 22], "text": "if items == previous" },
  "original": { "file": "src/cart.ts", "span": [31, 7, 31, 31], "text": "if (items === previous)" },
  "types": { "items": "Item[]", "previous": "Item[]" },
  "slice": { "file": "src/cart.nuc", "span": [10, 1, 20, 1] },
  "candidates": ["items == previous", "same(items, previous)"],
  "state": "open"
}
```

- `slice` is the declaration around the point (its function or method): what the agent reads, and all it reads.
- `state`: `open`, `resolved` (with `answer` and `by`: `user`, `agent:<name>`), `rejected` (the answer did not pass
  `nuclear check`; the point stays open).
- The codes are a new range, `N04xx`, documented in `nuclearlang/docs/07-reference/diagnostics.md`.

## The importer

- **Where**: a project of `tools/` (its name is a decision of the user), written in Nuclear (root `AGENTS.md`, rule
  9) with the dialect of the language it reads where the parser lives there: the TypeScript compiler API
  (`nuclearlang/tools/node/`), Python's `ast`, Dart's `package:analyzer`, which the type definitions generators
  already use (`nuclearlang/tools/defs/`).
- **What it translates by itself**: the base language (declarations, expressions, control flow, the standard
  library's names to Nuclear's, `library.md`), the libraries through `nuclear add` and their definitions, and the
  framework's shapes through the platform's generators.
- **What it never does**: translate a construct whose meaning changes without a point; write a point's answer
  itself.

## The agent

- MCP: `nuclear_port_points(project, state?)` lists points; `nuclear_port_resolve(project, id, answer)` checks the
  answer with the compiler and applies it, or rejects it with the diagnostics.
- The Nuclear Developer: a strategy `port-point` (one point, its slice, one answer), measured by its evaluation like
  every strategy.
- The answer replaces the point's span, or the slice when it changes more than the span; never more than the slice.

## The proof

The original project's tests run with the original's toolchain; the Nuclear project's tests (ported by the same
tool) run with `nuclear test` in every dialect of the platform; `nuclear port --verify` compares the two results.
