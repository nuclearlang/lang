---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0010: Every word is documented for the editor, and the compiler corrects what an agent writes by reflex or invents

## Context and problem

The user asked that agents read and understand Nuclear, the framework and every dialect "as if the model had been
trained on them". A model cannot be trained here, and a measurement showed that a brief alone changes little:
agents copy the project's `.nuc` and fail where they write by reflex. So the knowledge goes where the agent and the
developer already look: the editor's hover, the errors of the compiler and the shell.

## Decision

**Doc comments.** The comment right above a declaration is its documentation, with JSDoc-like tags (`@param name
text`, `@return`, `@throws`, `@example` with code on the following lines, `@see`, `@deprecated`, `@since`; the type
comes from the signature). The editor shows it in hover, completion and signature help; the dialect writes it with
the optional `doc_comment` template.

**Every word has documentation.** Every word of the base (`base/docs.toml`) and of each dialect (`docs.toml` next
to `dialect.toml`) has it; a build never reads it.

**Habits (N0022, `crates/nuclear-syntax/src/habits.rs`).** A line scan, before the parser's errors, of the forms of
TypeScript, Dart, Python, Java and Go: `{ }` blocks, `await`, `const/let/var/final x =`, `new`, `class A extends
B`, `class A(B):`, the return type first (`int f(int x)`, `Widget build(BuildContext context)`),
`def`/`function`/`fn`, trailing `:`, `elif`, `except E as e`, `None/True/False/undefined/nil`, `self`, `pass`,
`lambda x:`, `#` comments, f-strings, backticks, `x++`, `import`/`from ... import`, `switch`, C `for (`. Each one
gives the Nuclear form and, when exact, a `fix` (the agent hook and the language server apply it). The other errors
of those lines are dropped.

**Invented APIs.** In a file of a project (a single file cannot see its neighbours) with type definitions, a
PascalCase call nothing defines is N0220 (did you mean: edit distance over the project, the auto-imports and the
globals) and a named argument the constructor lacks is N0219 (it lists the real ones). `index.json` carries
`params` (the unnamed constructor) per class, so the build stays as fast (no `api.json` read);
`tools/defs/index_params.py` adds them to existing packages and the generators write them. A class imported under
that name from another package is not checked (`Dialect::def_libraries`). The names of `implicit` libraries are
`globals`.

**Words on demand.** `nuclear help <word> --dialect <d>` prints the `docs.toml` entry of a kind, a decorator or a
header word (the same text as the editor's hover); `nuclear help words --dialect <d>` lists them with their first
line.

**llms.txt.** The website publishes `/llms.txt` (llmstxt.org: the sheets first, then the reference) and
`/llms-full.txt` (every brief + the reference), generated from the same files.

The skill, the `AGENTS.md` template and the base brief say that the compiler corrects habits and how to look up
words.

## Options considered

1. Training a model on Nuclear: not possible here.
2. The brief alone: measured, it changes little.

## Consequences

- Positive: an agent that writes TypeScript, Dart or Python by reflex gets one exact correction per line instead of
  a cascade of N0013; an invented widget or argument fails in Nuclear, not later in the target's compiler; the
  editor and the command line show the same text for a word.
- Negative: a false positive of the habits scan is a bug: every `.nuc` of the tree and every `nuclear` block of the
  documents must give none, checked by hand when the rules change. How much it helps agents is not measured yet
  (`docs/01-product/roadmap.md`).

## References

- `docs/07-reference/diagnostics.md` (N0021, N0022, N0219, N0220), `docs/07-reference/dialects.md` §5.7,
  `docs/02-architecture/syntax.md`, `docs/02-architecture/emitter-options.md`.
- Replaces: ADR-0079, ADR-0088
