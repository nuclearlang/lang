---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [vision.md, ../02-architecture/overview.md]
---
# Glossary

Use these terms in the code, the documents and the conversations.

| Term | Meaning | Where it is in the code |
|---|---|---|
| Nuclear, the base language | What works the same in every dialect: `docs/07-reference/nuclear-base.md` | `crates/nuclear-syntax`, `base/nuclear.toml` |
| `.nuc` | The extension of a Nuclear source file | — |
| Dialect | Data files (TOML + templates) that teach the transpiler a target language or framework | `dialects/<language>/`, `crates/nuclear-dialect/src/model.rs` |
| Language dialect | A dialect of a target language: `typescript`, `dart`, `python`, `nodejs` | `dialects/<language>/dialect.toml` |
| Framework dialect | A dialect that extends a language dialect with a framework and names its platform: `flutter`, `fastapi`, `nestjs`, `react` | `dialects/<language>/frameworks/<dialect>/` |
| Dialect chain | A dialect and the ones it extends, down to its language (`nestjs` → `nodejs` → `typescript`) | `Dialect.chain` |
| Platform contract | What a platform of the framework declares, the same for each of its dialects: `platform.toml` | `Loader.platform_paths`, `PLATFORM_FILE` |
| Header + block | The one shape of a declaration: the words before the name are kinds or modifiers, the words after it are clauses, the body is an indented block | `Decl.words`, `crates/nuclear-syntax/src/parser.rs` |
| Kind | A header word a dialect defines that generates a declaration (`stateless`, `usecase`, `model`) | `[kinds.<name>]`, `Dialect.kinds` |
| Kind package | Extension kinds written on top of a dialect, enabled per project | `Loader.packages`, `kinds/<name>/kind.toml` |
| Modifier, clause | A header word before the name that is not a kind (`static`, `get`); a word after the name (`on`, `with`) | `[modifiers]`, `[clauses]` |
| Shortcut | What a dialect compresses: `use` shortcuts, auto-imports, function shortcuts, kinds | `[imports]`, `[auto_imports]`, `[functions]` |
| Auto-import | An import the transpiler writes because the generated code names something | `Dialect.auto_imports`, `emit::code_words` |
| Contract (of the dialect format) | The list of templates, the variables of each and the options a dialect can define; what `nuclear spec` prints | `crates/nuclear-dialect/src/contract.rs` |
| Contract (of a project) | What a project exposes (models, routes or calls), in Nuclear notation: `.nuclear/contract.json` | `crates/nuclear-transpile/src/contract.rs` |
| Type definitions (defs) | The public API of the target's libraries, in Nuclear notation, as packages `name@version` (like `.d.ts`) | `dialects/<language>/defs/<package>/<version>/`, `crates/nuclear-dialect/src/defs.rs` |
| Standard library | The members of Nuclear's base types and a few objects (`Math`, `Json`, `Regex`...), translated by every language dialect | `crates/nuclear-dialect/src/library.rs`, `dialects/<language>/library.toml` |
| Diagnostic | An error or warning with a code (N00xx syntax, N01xx resolver, N02xx dialect, N03xx project), a position and, when exact, a fix | `crates/nuclear-diag/src/lib.rs` |
| Habit | A form of another language written by reflex (`await`, `const x =`, `{ }` blocks): reported as N0022 with the Nuclear form | `crates/nuclear-syntax/src/habits.rs` |
| Golden file | The expected output of an example, compared by a test and regenerated with `UPDATE_GOLDEN=1` | `examples/`, `crates/nuclear-transpile/tests/golden.rs` |
| Equivalence | A Nuclear block followed by its target block in a reference document; it must be the real output | `tools/spec-check/` |
| Brief | The short sheet for agents of the base language or a dialect; `nuclear spec --brief --dialect <d>` prints the base's plus the chain's (at most 4k tokens with `flutter`) | `docs/07-reference/brief/`, `dialects/<language>/docs/07-reference/brief/` |
| Project | Several `.nuc` files built together: a folder with `nuclear.toml`, with a `config.nuc` that names its platform and dialect, or with the dialect's marker | `crates/nuclear-transpile/src/project.rs` |
| Project card | `.nuclear/project.json`: name, platform, dialect, language, output folder, plugins and where each kind comes from | `project::metadata`, `METADATA_FILE` |
| Project map | `.nuclear/map.md`: every declaration of a project with its kind, description and members, grouped by component | `crates/nuclear-transpile/src/map.rs` |
| Line map | For each generated file, the pairs (output line, `.nuc` line): what a debugger reads | `Output::lines`, `project::line_map` |
| Home | Where NuclearLang's files are: an install (`$NUCLEAR_HOME`) or the source tree; both have `dialects/` and `platforms/` | `nuclear_dialect::Home` |
| Module | Nuclear's unit with fields, methods, a constructor and inheritance (a class in the targets) | `Decl` in `ast.rs` |
