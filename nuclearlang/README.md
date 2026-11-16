# NuclearLang — the language

The base language (`.nuc`), the compiler that turns it into TypeScript, Dart or Python through declarative
dialects, and the language server every editor runs. One way only: `.nuc` → `.ts` / `.dart` / `.py`.

## Why it exists

AI coding agents and the people who work with them spend tokens and make mistakes on languages that have several
ways to write each thing. Nuclear is built for them: one way to write each thing, the fewest tokens, diagnostics
that come with their fix, a reference they can follow, and type definitions so they do not invent APIs. A developer
gets the same editor support as a native language; a dialect author adds a target without touching Rust.

What it leaves out on purpose: reading target code; changing the parser for a dialect; object orientation as a
goal (modules have constructors and inheritance only so that it transpiles to object-oriented languages); records,
a `type` keyword, visibility modifiers, inferred parameters, hoisting; wrapping the target's libraries; a package
manager of its own. What it cannot express yet: [docs/02-architecture/limits.md](docs/02-architecture/limits.md).
The whole vision: [docs/00-context/vision.md](docs/00-context/vision.md).

## How we made it

- **One golden rule**: performance, speed and readability of the syntax. A rule, kind or shortcut that breaks one
  of the three is rejected; the compiler also writes a map of each project so an agent goes to the code it needs
  ([ADR-lang-0001](docs/03-adr/0001-principles.md)).
- **Few symbols, two-space blocks**: words for logic, symbols for arithmetic and bits
  ([ADR-lang-0002](docs/03-adr/0002-files-and-lexical-syntax.md)); a function returns its last line and awaits with
  `~` ([ADR-lang-0003](docs/03-adr/0003-functions-lambdas-and-async.md)).
- **Errors are values**: `Result<E, T>`, propagated on its own ([ADR-lang-0006](docs/03-adr/0006-results.md)).
- **Dialects are data.** The parser is generic; a dialect's words arrive as data in a declaration header. Rust
  decides *what* is emitted, the dialect's TOML and templates decide *how*. A need of one target becomes a generic
  option any dialect can use. The transpiler writes the imports itself
  ([ADR-lang-0007](docs/03-adr/0007-dialects-and-imports.md)).
- **Type definitions, like `.d.ts`**: versioned packages generated from the installed target libraries give the
  imports, the inherited members and the checks against invented APIs
  ([ADR-lang-0008](docs/03-adr/0008-type-definitions-and-target-packages.md)).
- **A standard library of its own** for the base types, translated by every language dialect
  ([ADR-lang-0009](docs/03-adr/0009-standard-library.md)).
- **The compiler helps editors and agents**: every word is documented, and the habits of TypeScript, Dart, Python,
  Java and Go are caught with the Nuclear form and, when exact, a fix
  ([ADR-lang-0010](docs/03-adr/0010-compiler-helps-editors-and-agents.md)).
- **Debugging through the target's debugger** with a line map back to the `.nuc`
  ([ADR-lang-0011](docs/03-adr/0011-debugging-nuc.md)).

It is Rust (edition 2024), five crates of the tree's Cargo workspace:

```
 .nuc ─► nuclear-syntax (lexer, parser, AST, formatter) ─► nuclear-transpile (resolver, emitter, projects) ─► .ts / .dart / .py
                                                              ▲
                          nuclear-dialect (dialects/*.toml, templates, type definitions)
 nuclear-diag: diagnostics N00xx–N03xx, text and JSON       nuclear-lsp: the language server
```

The goals are measured ([vision](docs/00-context/vision.md)): the output passes `flutter analyze` with
`flutter_lints`, `tsc --strict` and `pyright`; a project of 26 files builds in about 20 ms in release; a completion
of the server takes under 1 ms. The pipeline and which file does what:
[docs/02-architecture/overview.md](docs/02-architecture/overview.md).

## Try it

From the root of the tree (or with the installed `nuclear` in place of `cargo run -q -p nuclear-cli --`). Save as
`hello.nuc`:

```
fullName(firstName: string, lastName: string) string
  "${firstName} ${lastName}"
```

```sh
cargo run -q -p nuclear-cli -- build hello.nuc --dialect python
#   def full_name(first_name: str, last_name: str) -> str:
#       return f"{first_name} {last_name}"
cargo run -q -p nuclear-cli -- build hello.nuc --dialect dart
#   String fullName(String firstName, String lastName) {
#     return '$firstName $lastName';
#   }
cargo run -q -p nuclear-cli -- check hello.nuc --dialect python --json   # [] when there is no error
cargo run -q -p nuclear-cli -- fmt hello.nuc                             # the canonical layout
cargo run -q -p nuclear-cli -- help guide                                # the language, chapter by chapter
cargo test                                                               # every crate, the golden examples
```

A typo such as `nam` for `name` gives `error[N0106]: 'nam' is not defined; did you mean 'name'?` with its line
and column. From this folder, `tools/stdlib-check.sh` runs `examples/stdlib/` in TypeScript, Dart and Python and checks
that the three print the same (it needs node, dart, TypeScript and `tools/python/.venv`).

The language server (`nuclear-lsp`) is installed by `installer/install.sh` and started by the editors
([../extensions/](../extensions/AGENTS.md)); what it does: [crates/nuclear-lsp/README.md](crates/nuclear-lsp/README.md).

## Where to read next

- [The guide](docs/08-guides/README.md) (`nuclear help guide`) and [the language on one page](docs/08-guides/reference.md).
- The reference: [nuclear-base.md](docs/07-reference/nuclear-base.md), [grammar.ebnf](docs/07-reference/grammar.ebnf),
  [library.md](docs/07-reference/library.md), [diagnostics.md](docs/07-reference/diagnostics.md),
  [dialects.md](docs/07-reference/dialects.md) (the format of a dialect).
- [Create a dialect with an agent](docs/08-guides/create-a-dialect-with-an-agent.md).
- [The dialects](dialects/README.md): what each target and framework adds.
- [AGENTS.md](AGENTS.md): to change the language, the compiler or the server. The `nuclear` command is
  [../tools/cli/](../tools/cli/AGENTS.md).
