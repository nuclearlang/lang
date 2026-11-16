---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0002: Files are `.nuc`, blocks are two spaces, words for logic and symbols for arithmetic and bits

## Context and problem

The lexical layer decides how many tokens a program costs and how often an agent hesitates between two forms.
Nuclear also had to "have nothing to envy any language" in math, text, regular expressions, bytes and physics
without breaking its rules: the syntax lacked power, integer division, bitwise operators, shifts, binary and
scientific literals and raw text.

## Decision

**Extension.** Nuclear source files use `.nuc`.

**Indentation.** Two spaces, as in Elixir: fewer tokens, a common standard.

**Quotes and interpolation.** `"..."` and `'...'` are the same, also for interpolation and multi-line text (`"""`
or `'''`). Interpolation is `"${expr}"`, as in Dart.

**Comments.** A multi-line comment continues on lines that start with ` * `, the `*` right below the second `/` of
`//` (like `/** */`). A lone `*` is an empty line; `@example` code has more space after the `*`. A line indented
another way is N0021, with its fix. In the editor, Enter inside a comment adds the ` * ` and Enter on an empty ` * `
line ends it.

**Logical operators.** `and`, `or`, `not`. One form only: two forms would be ambiguous.

**Arithmetic and bitwise operators.** The same grammar for every dialect; each dialect writes them in
`[operators]`: `a ** b` (right associative, above unary minus: `-2 ** 2` is -4), `a ~/ b` (integer division,
Dart's token), `&`, `|`, `^`, `<<`, `>>`, `>>>`, and `^x` for the complement (`~` is await, as in Go). Precedence as
in Python and Dart: comparisons < `|` < `^` < `&` < shifts < `+`. Compound `%= &= |= ^= <<= >>= >>>=`. `>>` and
`>>>` are `>` tokens written together, joined by the parser, so `List<List<int>>` keeps working.

**Literals.** `0b1010`, `1.5e-3`, and raw text `r"\d+"` (no escapes nor interpolation), for regular expressions.

**Semantics that stay the target's**, documented: `%` (TypeScript keeps the dividend's sign, Dart is never
negative), the integer width of bitwise operators (32 bits in TypeScript, 64 in Dart), the rounding of halves.

**What the emitter gives the operator templates.** The operands' numeric kind (`int`/`double`, for Dart's `pow`
returning `num`) and bare operands (`left_arg`); `in` knows maps; `is` gets the type's info; `try` as the last line
is a value; a Dart top-level variable used by a declaration stays top-level; statements plus a `main` are N0113.

Every area of the library has one program in `examples/stdlib/` that prints the same output in every target, run by
`tools/stdlib-check.sh`. Which library those programs call is decided in ADR-lang-0009.

## Options considered

1. `.nl` or `.nuclear` as the extension: rejected.
2. `&&`, `||`, `!`: rejected, one form only.
3. Words for the operators (`div`, `xor`, `shl`, as in Kotlin): more reserved words; C symbols are what every agent
   knows.
4. `~x` for the complement: `~` is await.
5. Defining `%` the same in every target: either the Dart or the TypeScript output would stop being the expert's.

## Consequences

- Positive: formulas read as written (`0.5 * mass * speed ** 2`); bit manipulation needs no library calls; one
  form for each thing.
- Negative: `%`, integer widths and rounding differ between targets; the editors' grammars (TextMate, tree-sitter)
  must know the operators and `r"..."`.

## References

- `docs/07-reference/nuclear-base.md` §2 and §6.1, `docs/07-reference/grammar.ebnf`,
  `docs/02-architecture/syntax.md`.
- Replaces: ADR-0001, ADR-0004, ADR-0009, ADR-0010, ADR-0011, ADR-0080, ADR-0086
