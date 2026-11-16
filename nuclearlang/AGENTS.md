# NuclearLang — the language

The base language (`.nuc`), the compiler that turns it into the code of another technology through declarative
dialects (`.nuc` → `.ts` / `.dart` / `.py`, one way only), and the language server every editor runs. For AI agents
and the people who work with them: few tokens, one way to write each thing, diagnostics with fixes.

Paths in these documents are relative to this folder (`nuclearlang/`); `../` is the root of the tree. The rules of
the whole platform are in [`../AGENTS.md`](../AGENTS.md).

## Stack

- Compiler and language server: Rust (edition 2024), five crates of the tree's one Cargo workspace
  (`../Cargo.toml`); `../rustfmt.toml` (`max_width = 120`).
- Dialects: TOML + templates of a Mustache subset, loaded at run time (`crates/nuclear-dialect/src/template.rs`).
- Type definitions generators (`tools/defs/`): Dart with `package:analyzer`, Python with `inspect`, JavaScript with
  the TypeScript compiler.
- Checks: `tools/spec-check` (Python + a Rust binary with its own workspace), `tools/stdlib-check.sh` (bash; needs
  node, dart, TypeScript and `tools/python/.venv`).

## Commands

```sh
# from the root of the tree
cargo test                         # every crate of the workspace
cargo clippy --all-targets
UPDATE_GOLDEN=1 cargo test         # regenerate the golden files, then review the diff
cargo test -p nuclear-lsp          # the language server alone

# from nuclearlang/
tools/spec-check/check.py dialects/<language>/docs/07-reference/<dialect>.md <dialect> <language> [--fix]
tools/stdlib-check.sh [area...]    # examples/stdlib/ in TypeScript, Dart and Python: the same output
FLUTTER_ROOT=~/develop/flutter tools/defs/generate.sh    # dialects/dart/defs/ (about 45 s)
tools/defs/python/generate.sh      # dialects/python/defs/
tools/defs/typescript/generate.sh  # dialects/typescript/defs/
```

The `nuclear` command (`build`, `check`, `fmt`, `spec`, `defs`, `help`..., and the framework's `new`, `make`, `gen`,
`run`...) is another project: [`../tools/cli/`](../tools/cli/AGENTS.md); what `make` and `gen` write is
[`../tools/code_generator/`](../tools/code_generator/AGENTS.md).

## Folders

- `crates/nuclear-diag/`: diagnostics, positions, codes N00xx–N03xx, text and JSON.
- `crates/nuclear-syntax/`: lexer, parser, AST, doc comments, the formatter, the habits of other languages.
- `crates/nuclear-dialect/`: loading and validating dialects, templates, the contract, type definitions, the
  standard library's vocabulary.
- `crates/nuclear-transpile/`: resolver, emitter, projects of several files, contracts, the project map.
- `crates/nuclear-lsp/`: the language server (`nuclear-lsp` binary).
- `base/`: the reserved words of the base language (`nuclear.toml`) and their editor documentation (`docs.toml`).
- `dialects/<language>/`: `python`, `typescript`, `dart`, `nodejs`; each is its own project with its own
  `AGENTS.md` and `docs/` (its `frameworks/<dialect>/` and its `defs/` live there).
- `examples/`: golden examples (`examples-nodejs/`, `examples-python/`, `spec/`), `projects/` with `expected/`,
  `stdlib/` (one program per area with its expected output).
- `tools/`: `defs/` (the generators), `spec-check/`, `stdlib-check.sh`, `node/` and `python/` (the target
  libraries the checks and the generators read).
- `docs/`: the context documentation (map below).

## Rules of this project

- **The parser does not change per dialect.** Dialect words arrive as data in a declaration header; framework
  words, shortcuts and imports live in `dialects/`.
- **Rust decides *what* is emitted; the dialect decides *how* it is written.** The transpiler knows no target
  language. What a new target needs is a generic `[options]` option, never a case of one language.
- No inferred parameters, no hoisting, no `type`.
- A changed variant of `crates/nuclear-syntax/src/ast.rs` or a public API of a crate breaks its users (the language
  server, `../tools/cli/`, `../tools/code_generator/`): the workspace's `cargo test` must stay green.
- Every new diagnostic code is documented in `docs/07-reference/diagnostics.md`; every word of a dialect in its
  `docs.toml` (two tests check it).
- `docs/07-reference/nuclear-base.md` holds only final rules and only Nuclear: no dialect, no target language, no
  questions, no history. A dialect's equivalences are the real output (`tools/spec-check`, 0 problems).
- A new `.md` in `docs/07-reference/` or `docs/08-guides/` must be a topic of `nuclear help` (`../tools/cli/`
  embeds them; a test checks it).
- `dialects/<language>/defs/` is generated: never edited by hand.
- Generated code changed: `UPDATE_GOLDEN=1 cargo test` and the diff reviewed.
- A feature starts as a spec in `docs/04-specs/`; a decision of the user becomes a new ADR in `docs/03-adr/`.
- Node.js/Express is postponed by the user: do not touch it until asked.
- What is not documented and cannot be read from the code is asked, not invented.

## Documents (open one only when its line matches the task)

| You need | Read |
|---|---|
| What the language is for, its users, what it does not do | [docs/00-context/vision.md](docs/00-context/vision.md) |
| The meaning of a term (kind, dialect chain, contract, line map...) | [docs/00-context/glossary.md](docs/00-context/glossary.md) |
| The pending work of the language, the compiler and the server | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The pipeline, the crates, which file does what | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| The crates' dependencies, tool versions, paths on the machine | [docs/02-architecture/dependencies.md](docs/02-architecture/dependencies.md) |
| What other projects use of this one: the Rust API, the LSP requests, the files a build writes | [docs/02-architecture/integrations.md](docs/02-architecture/integrations.md) |
| Lexer or parser work: indentation, comments, operators, the habits scan | [docs/02-architecture/syntax.md](docs/02-architecture/syntax.md) |
| Any change to the generated code | [docs/02-architecture/emitter.md](docs/02-architecture/emitter.md) |
| An `[options]` key, a target without braces, the checks against the type definitions | [docs/02-architecture/emitter-options.md](docs/02-architecture/emitter-options.md) |
| `Result<E, T>`, propagation, `.ok()` / `.error()`, function aliases | [docs/02-architecture/result.md](docs/02-architecture/result.md) |
| A kind, decorator, option or template of a dialect; where dialects are found | [docs/02-architecture/dialects.md](docs/02-architecture/dialects.md) |
| A missing or wrong import, an override not detected, regenerating `defs/` | [docs/02-architecture/type-definitions.md](docs/02-architecture/type-definitions.md) |
| Builds of several files, `[project]`, `[architecture]`, `config.nuc` checks | [docs/02-architecture/projects.md](docs/02-architecture/projects.md) |
| The language server: modules, completion, hover, projects, bundles | [docs/02-architecture/language-server.md](docs/02-architecture/language-server.md) |
| Before promising a feature: what Nuclear cannot express yet | [docs/02-architecture/limits.md](docs/02-architecture/limits.md) |
| Why a rule exists | [docs/03-adr/README.md](docs/03-adr/README.md) |
| A feature with a plan (dialects created by agents, the language to 1.0) | [docs/04-specs/README.md](docs/04-specs/README.md) |
| The rules to write code and documentation here | [docs/05-standards/coding.md](docs/05-standards/coding.md) |
| Which test to add, where a golden file lives, checking against the real target | [docs/05-standards/testing.md](docs/05-standards/testing.md) |
| The rules of the language (normative) | `docs/07-reference/`: `nuclear-base.md`, `grammar.ebnf`, `library.md`, `dialects.md`, `definitions.md`, `projects.md`, `diagnostics.md`, `reserved-words.md`, `brief/` |
| The guide a user reads | [docs/08-guides/README.md](docs/08-guides/README.md) |
| What the server does, as a user sees it; code metrics | [crates/nuclear-lsp/README.md](crates/nuclear-lsp/README.md) |
| The type definitions generators | [tools/defs/README.md](tools/defs/README.md) |
