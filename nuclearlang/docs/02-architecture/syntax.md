---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../03-adr/0002-files-and-lexical-syntax.md, ../03-adr/0010-compiler-helps-editors-and-agents.md]
---
# Lexer and parser

Read this when you change `crates/nuclear-syntax`: indentation, comments, blocks inside parentheses, generic calls,
operators, the habits scan.

## Indentation

The lexer emits INDENT/DEDENT so the parser works as if there were braces. Inside `()[]{}` indentation is
ignored, except for a lambda block: after `=>` + newline, or after `(params)` (a `(` after `=`, `(`, `[` or
`,`) + a more indented line. The block ends when the indentation returns to its first line; the lexer
synthesizes the `,` if missing. A `.method()` line less indented than the open block closes it and continues
the chain (parser: `chain_after_block`).

## Comments

A `//` at the start of a line continues on ` * ` lines (the `*` in the column of the second `/`); the text of
each is what follows `* `. A more indented line of another shape still belongs to the comment but is N0021,
with its fix. Trailing empty lines (a lone ` *`) are dropped. The comment right above a declaration is its
documentation (`DocComment`). Decisions: ADR-lang-0002 (the ` * ` lines), ADR-lang-0010 (doc comments).

## Punctuation details

- `!` right after a name/`)`/`]` is `Punct::Bang` (non-null); anywhere else it is N0009 (use `not`).
- The `<` of a generic call must touch the name (`call_type_args`); with a space it is a comparison.
- `>>`, `>>>`, `>>=`, `>>>=` are NOT tokens: the parser joins `>` tokens written together (`glued_gt`), so
  `List<List<int>>` still closes two generics. `<<`, `<<=`, `**`, `~/`, `&`, `^`, `%=`, `&=`, `|=`, `^=` are tokens.
  Precedence: comparison < `|` < `^` < `&` < shifts < `+` < `*` `~/` < unary (`-` `~` `^`) < `**`.
- `r"..."` (an `r` touching a quote) is raw text: no escapes, no interpolation (`raw_string`). Numbers: `0b1010`
  (`NumberKind::Bin`), exponents `1.5e-3` (Float).
- `..` with `nl_before` is a cascade, not a range. The parser does not open cascades inside a section
  (`in_cascade`); a `.` line below a section continues that section (as in Dart).

## AST shape

`Decl.words` (kinds/modifiers before the name), clauses after it, `Decl.generic_bounds` (`<T: Comparable>`),
`Call.type_args`, `ExprKind::{Spread, ListIf, Cascade, CascadeSelf}`, destructuring patterns. `BinaryOp` has
`IntDiv Pow BitOr BitXor BitAnd Shl Shr UShr`, `UnaryOp::BitNot`, `AssignOp::{Rem, BitAnd, BitOr, BitXor, Shl,
Shr, UShr}`. The language server and the command line tools walk the AST themselves: changing variants breaks
`crates/nuclear-lsp`, `../tools/cli/` and `../tools/code_generator/`.

## Habits of other languages

`habits::scan` (called by `parse`) masks strings and comments, then looks at each line for forms of TypeScript,
Dart, Python, Java and Go (`{ }` blocks, `await`, `const x =`, `new`, `class A extends B`, the return type first,
`def`, trailing `:`, `elif`, `None`, `#`, `x++`, `import`...) and reports N0022 with a fix when it is exact. `parse`
drops the other diagnostics of those lines. A false positive is a bug: every `.nuc` of the tree and every
`nuclear` block of the documents must give none (checked by hand when the rules change; tests in `habits.rs`).
Decision: ADR-lang-0010.

## The formatter

`fmt::format` rewrites only the gaps between tokens (indentation, spaces, blank lines, comments), copies every
token as written and refuses a result that does not lex to the same tokens and comments (it returns `Err`). It
only reflows: it adds no trailing commas and wraps no long lines. `tests/fmt.rs` holds every `.nuc` under
`examples/`, `dialects/`, `packages/` and `kinds/` of the language and of each platform as a fixed point.
