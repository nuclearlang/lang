---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [dependencies.md, integrations.md, syntax.md, emitter.md, dialects.md, ../03-adr/0001-principles.md]
---
# Architecture

## The pipeline

```
 .nuc text                                   dialects/<language>/*.toml (+ defs/)
   │ 1 LEXER     text → tokens (INDENT/DEDENT)        │ loaded at run time:
   │ 2 PARSER    tokens → AST (no format)             │ inheritance, merge, validation
   │ 3 RESOLVER  block scope, undefined names,        ▼
   │             implicit this, const/let, async ◄── Dialect: kinds, shortcuts, auto-imports
   │ 4 EMITTER   AST → dialect templates        ◄── [syntax] [types] [operators] [options]
   ▼
 .ts / .dart / .py text  (+ line map target → .nuc for debuggers)
```

Each stage knows only the previous one. Diagnostics accumulate in all of them (text or JSON).

## Design rules

1. The lexer turns indentation into tokens; inside `( ) [ ] { }` it emits none (line continuation).
2. The AST has no format; every node keeps its `Span` for errors and the language server.
3. The parser is generic: dialect words (`stateless`, `static`) arrive as data in a declaration header.
4. The transpiler knows no target language: TypeScript, Dart and Python are dialects like any other.
5. Data before code: dialects, shortcuts and imports are files read at run time; the same files feed the command
   line tool, the language server and the MCP server.
6. Imports are decided after emitting, from the words of the generated code (`emit::code_words`).

## Crates

| Crate | Input → output |
|---|---|
| `nuclear-diag` | `Diagnostic`, `SourceFile`, codes N00xx (syntax), N01xx (resolver), N02xx (dialect), N03xx (project); text and JSON |
| `nuclear-syntax` | text → `Lexed` (tokens) → `Parsed` (AST + diagnostics); `DocComment`; the formatter |
| `nuclear-dialect` | `dialects/<language>/*.toml` + `defs/` packages → `Dialect` + `Report`; templates, contract, `Dialect.typedefs` (lazy `api.json`) |
| `nuclear-transpile` | text + `Dialect` → `Output` (code + diagnostics + line map); `check()` for the language server; `project::build` |
| `nuclear-lsp` | the language server binary → [language-server.md](language-server.md) |

## Which file does what

| Path | What it does |
|---|---|
| `crates/nuclear-diag/src/lib.rs` | `Diagnostic`, `SourceFile`, the table of codes with their explanations |
| `crates/nuclear-syntax/src/lexer.rs`, `token.rs` | tokens + INDENT/DEDENT (none inside `()[]{}`) → [syntax.md](syntax.md) |
| `crates/nuclear-syntax/src/parser.rs`, `ast.rs` | `parse(src) -> Parsed`. "Header + block": words before the name are kinds or modifiers (`Decl.words`), words after it are clauses |
| `crates/nuclear-syntax/src/habits.rs` | the forms of other languages written by reflex (N0022) → [syntax.md](syntax.md) |
| `crates/nuclear-syntax/src/fmt.rs` | `nuclear fmt`: rewrites only the gaps between tokens (indentation, spaces, blank lines, comments), copies every token as written and refuses a result that does not lex to the same tokens and comments; `tests/fmt.rs` keeps every `.nuc` of the tree formatted |
| `crates/nuclear-syntax/src/doc.rs` | `DocComment::parse`: doc comments with `@param/@return/@throws/@example/@see/@deprecated/@since`; `markdown()`, `param(name)` |
| `crates/nuclear-dialect/src/template.rs` | Mustache subset: `{{x}}`, `{{#x}}`, `{{^x}}`, `{{.}}`, `@first/@last/@index`, filters `pascal camel snake kebab lower upper join:", "` |
| `crates/nuclear-dialect/src/contract.rs` | SYNTAX/TYPES/OPERATORS templates, the variables of each kind, OPTIONS; `markdown()` is what `nuclear spec` prints |
| `crates/nuclear-dialect/src/model.rs` | `Loader`, `Dialect`, `Report`: `extends`/`replaces`, several `.toml` merged, `{ file = "templates/x.tpl" }`, validations N0204/N0205/N0210/N0212; `Loader::load_defs`, `add_defs`; kind packages → [dialects.md](dialects.md) |
| `crates/nuclear-dialect/src/defs.rs` | type definitions: `Package`, `Repository`, `TypeDefs`, `render*` → [type-definitions.md](type-definitions.md) |
| `crates/nuclear-dialect/src/library.rs` + `dialects/<language>/library.toml` | the standard library (ADR-lang-0009, `docs/07-reference/library.md`): the vocabulary in Rust (bases, members, result types, wrong target names), one template per member in each language dialect (`docs/07-reference/dialects.md` §5.8; `helper` written once per file) |
| `crates/nuclear-dialect/src/lib.rs` | `base_doc` (the editor documentation of `base/docs.toml`, compiled in), `install_dir`, `Home`, `homes`, `defs_cache_dir` |
| `crates/nuclear-transpile/src/lib.rs` | `transpile()` and `check()` |
| `crates/nuclear-transpile/src/analysis.rs` | reassigned names per block (const/let), awaits → async, `yields_block`, `pattern_names` |
| `crates/nuclear-transpile/src/alias.rs` | `f() = Module.method` rewritten before emitting → [result.md](result.md) |
| `crates/nuclear-transpile/src/emit.rs` | the template-driven emitter (the largest file) → [emitter.md](emitter.md); the standard library rewrite: `static_type` (the receiver's type), `library_access`, `library_render`, N0114/N0115 |
| `crates/nuclear-transpile/src/helpers.rs` | the helpers of the language (lodash in Nuclear, embedded): which ones a file uses, their source with the ones they call (ADR-lang-0013) |
| `crates/nuclear-transpile/src/naming.rs` | `options.snake_case_names`: camelCase names written in snake_case → [emitter-options.md](emitter-options.md) |
| `crates/nuclear-transpile/src/project.rs` | projects of several files → [projects.md](projects.md) |
| `crates/nuclear-transpile/src/contract.rs` | the contract of a project (`.nuclear/contract.json`), its OpenAPI document, and the Nuclear a client generates from the contracts its manifest declares → [integrations.md](integrations.md) |
| `crates/nuclear-transpile/src/map.rs` | the project map (`.nuclear/map.md`), `inventory`, `shape` → [integrations.md](integrations.md) |
| `base/nuclear.toml`, `base/docs.toml` | the reserved words of the base (the only ones the lexer knows; a test checks they match `token.rs`); their editor documentation |
| `examples/stdlib/` | one program per area (math, physics, bits, strings, regex, collections, types, bytes, dates, async) with its expected output `<area>.out`, the same for every target |
| `tools/stdlib-check.sh` | runs `examples/stdlib/` in TypeScript, Dart and Python; the three must print `<area>.out` |
| `tools/spec-check/` | checks that the equivalences of a reference document are the real output |
| `tools/defs/` | the type definitions generators; `flutter_project/` is also the host of the mobile platform's `analyze-flutter.sh` |

## The dialect chain

```
typescript ─► nodejs ─► nestjs   (backend platform)
typescript ─► react              (web platform)
python ─────► fastapi            (backend platform)
dart ───────► flutter            (dart: kinds extension, mixin, data · flutter: mobile platform)
```

A language dialect is `dialects/<language>/`; a framework dialect is `dialects/<language>/frameworks/<dialect>/`
and names its platform (`platform = "backend"`). Each language dialect and its frameworks are documented in that
language's own project (`dialects/<language>/AGENTS.md`); the platforms in `../nuclear-synapsis-framework/`.
