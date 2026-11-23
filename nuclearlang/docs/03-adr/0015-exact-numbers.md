---
status: accepted
date: 2026-11-23
deciders: Julian Molina
---
# ADR-lang-0015: The exact numbers `bigint` and `bigdouble`

## Context and problem

Nuclear had two number types, `int` and `double`, and both are the target's: TypeScript holds whole numbers exactly
only up to 2^53 − 1, and every target's `double` is binary (`0.1 + 0.2 != 0.3`). Money, identifiers of 64 bits,
counters and big factorials had no type that gives the same exact value in every target. The user decided on
2026-11-23: "create the data types `bigint` and `bigdouble` in Nuclear, and add the check functions for those types.
Yes, exact types."

## Decision

1. **Two base types.** `bigint`: a whole number of any size (TypeScript `bigint`, Dart `BigInt`, Python `int`).
   `bigdouble`: an exact decimal of any size and any number of decimals (Python `decimal.Decimal` computed in a
   context with no rounding, Dart `Decimal` of `package:decimal`, TypeScript a class of the dialect's own runtime).
2. **No new literal syntax.** A literal takes the exact type of its place (a typed name, a parameter, a return, a
   list declared of them, the other side of an operator): `x: bigint = 12345678901234567890`, `big + 1`,
   `price: bigdouble = 19.99`. It is written from its text, never through a binary number. A decimal literal where a
   `bigint` goes, and a whole literal beyond 2^53 − 1 anywhere else, are errors (N0119).
3. **Strict: no silent conversion.** An exact number never mixes with `int`, `double` or the other exact type
   (N0119); conversions are written: `toBigInt()`, `toBigDouble()`, `toInt()` (`null` outside ±(2^53 − 1), the
   integers every target's `int` holds), `toDouble()` (the nearest double).
4. **Operators**: `+ - * % ** ~/`, comparisons and `==` with the same meaning in every target. `%` is the remainder
   of `~/` (the dividend's sign). `/` of two `bigint` does not exist (N0120); `/` of two `bigdouble` is rounded half
   away from zero to the larger of 20 and the decimals of each side. The exponent of `**` is an `int` ≥ 0.
5. **Text**: a `bigint` prints its digits; a `bigdouble` its shortest exact text with at least one decimal (`0.3`,
   `2.0`), never an exponent, as `double` prints. Parsing (`text.toBigInt()`, `text.toBigDouble()`) accepts the same
   texts everywhere and gives `null` for any other: these are the check functions, in the shape of `text.toInt()`.
6. **JSON** has no exact number (a JavaScript parser rounds beyond 2^53): an exact number travels as the text of
   `toString()` and is read back with `toBigInt()` / `toBigDouble()`. `Json.encode` of a value known to hold one is
   N0120. The platforms' models will write and read their exact fields this way.
7. Lists and maps of exact numbers compare values with `==`, `!=` and `in` in every target (TypeScript's decimal
   needs the dialect's value comparison). Not theirs, refused with N0120 until each one is the same in every target:
   the bitwise operators, `is bigint` / `is bigdouble` (in Python an exact whole number is a plain `int`), `Math`, a
   `Set` of `bigdouble`, and the list members that compare or add the elements (`sum`, `min`, `max`; for
   `bigdouble` also `sorted`, `sort`, `unique`, `indexOf`, `lastIndexOf`, `remove`).

## Options considered

1. Literals by place (chosen): the smallest rule, no new token, and the place already says the type.
2. A suffix (`123n`, `0.1d`): a new lexical form, and `total + 1` would still need one on every literal.
3. Automatic widening (`int` → `bigint`): short, but a `double` → `bigdouble` widening would bring the binary error
   in, and the user asked for strict types.
4. TypeScript with `decimal.js`: its precision applies to `+ - *` too (20 significant digits by default, a global
   setting) and its rounding differs from the other targets; `big.js` is not a dependency of the dialect. A
   minimal decimal on the native `bigint` (about 150 lines, written once per file that uses it, like the `Result`
   runtime) gives exactly the rules above.

## Consequences

- Positive: the same exact values and the same text in the three targets (`examples/conformance/big_numbers.nuc`);
  strict typing finds every mix at compile time.
- Negative: a Dart app depends on `package:decimal`; TypeScript files that use `bigdouble` carry the class; several
  list members, JSON and the platforms' columns wait for their step (`docs/01-product/roadmap.md`).

## References

- The rules: `docs/07-reference/nuclear-base.md` §5.1; the members: `docs/07-reference/library.md` §5.1; the
  diagnostics N0119 and N0120: `docs/07-reference/diagnostics.md`; the equivalences: each language dialect's
  reference.
