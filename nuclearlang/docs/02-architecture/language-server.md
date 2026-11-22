---
status: accepted
owner: Julian Molina
updated: 2026-11-22
related: [integrations.md, projects.md, dialects.md, ../../crates/nuclear-lsp/README.md, ../01-product/roadmap.md]
---
# The language server (`crates/nuclear-lsp`)

Read this when you change the server or need how completion, hover, projects or the bundles work. What a user
sees of it (features, code metrics) is [its README](../../crates/nuclear-lsp/README.md); its interface for the
editors is in [integrations.md](integrations.md).

## Modules

| File | What it does |
|---|---|
| `src/rpc.rs` | JSON-RPC over stdio (`Content-Length`) |
| `src/text.rs` | byte offsets ↔ LSP positions (line + UTF-16 column) |
| `src/index.rs` | walks the AST: declarations (`Binding`) and uses (`Occurrence`) with semantic token and target; block scope; deferred `Enum.item` and named arguments; `doc_comment` |
| `src/features.rs` | semantic tokens, hover, completion, signature, definition, references, rename, outline, folding, quick fixes (any `data.fix` of a diagnostic), `on_type_formatting` |
| `src/server.rs` | state (open documents, dialect), dispatch, diagnostics, `nuclear/transpile`, code lens and metrics commands |
| `src/metrics.rs` | code metrics (a copy of CodeMetrics / tsmetrics-core) |
| `src/typedefs.rs` | `Dialect.typedefs`: prefix index of public names and extensions per type, `split`, `instance_members` (own, inherited, extensions, generics substituted), `static_items`, `static_call_type` |
| `src/project.rs` | projects of several files: the root, `Project::build`, `visible` (`test/` isolated), `knows`, `default_kind` (copied from the compiler), `with_project_defs` (`build/defs.lock`, roots `<project>/defs` + the cache; warnings in `config.nuc` for missing packages), rebuild when `defs.lock` changes |
| `src/dialects.rs` | dialect search paths, loading with the kind packages, keyword help, `builtin_doc` |
| `tests/server.rs` | end to end with `examples/` (including "no prefix of any example panics" and `project_packages_bring_their_definitions`) |

It uses the compiler crates as a library (the list is in [integrations.md](integrations.md)); a missing parser or
transpiler feature is built there, never copied into the server.

## How it works

- **Synchronous**, only `serde_json`; the whole document is analysed again on each change (`.nuc` files are small).
  It exits on stdin EOF; VS Code stops it 5 minutes after the last `.nuc` closes.
- **Dialect.** The default is `flutter`; `base`, `none`, `nuclear` or empty mean only the base language. Search
  order: the `nuclear.dialectPaths` setting, `$NUCLEAR_DIALECT_PATH`, `<workspace>/dialects`, the dialects next to
  the binary, the install (`nuclear_dialect::install_dir`), the source tree's `dialects/`. Dialects reload without a
  restart when a watched `.toml` changes. `nuclear.dialect` only applies to files outside a project.
- **Semantic tokens:** the LSP standard plus the modifiers `kind` (dialect kinds) and `deprecated`. Named arguments
  are colored as parameters (italic), not properties.
- **Types.** The type of `x` in `x.` is known only from written text or construction: an annotation, a typed
  parameter, `x = Class()`, `Class.named()` / `Class.static()` (its return, `Binding.inferred`), a module field, an
  inherited member of an external base (`Binding.bases` + the kinds' `inherits`). Unknown → nothing is offered.
  Generics are substituted along the chain (`Cubit<int>` → `BlocBase<int>` → `state: int`). The members of a base
  type are in `nuclear_dialect::library`; the emitter's receiver typing (`static_type`) is private to
  `nuclear-transpile`.
- **Free names:** a sorted lowercase index (binary search, at most 300, `isIncomplete`); the first `api.json` read
  takes about 16 ms, each completion under 1 ms in release.
- **Hover of an external class:** `render` without header comments (shown below as doc, package, library), cut at
  40 lines (`nuclear defs show` gives all).
- **Decorators:** completion after `@` and hover; inside `@screen(...)` its arguments and object fields (required
  first) from `decorator_args`, detected by text (`decorator_context`).
- **Documentation** (ADR-lang-0010): hover of kinds, decorators and words from `Dialect::doc` + the dialect's data;
  keywords, `Result/Ok/Err` and base types from `base_doc`; doc comments in hover, completion (`documentation`, the
  deprecated tag) and signature help (each `@param` next to its argument).

## Projects

- The root is the closest folder with `nuclear.toml`, a `config.nuc` naming `synapsis(platform, dialect)`, or
  `main.nuc` (the same order as `Manifest::find`).
- The project's dialect is loaded with the kind packages of `<project>/kinds` and `<install>/kinds`
  (`dialects::load`), cached by name, or by `name@root` when the project has `kinds/`.
- `Project::build` writes the project card (`project::write_metadata`); the VS Code status bar reads it, the
  JetBrains and Zed clients do not yet.
- Hover and completion of a kind say its source (`features::kind_source`: the language, native of the platform, a
  package), and only the kinds of the project's platform are listed.
- Built from disk on first open and on every save (about 20 ms in release for the 26-file example), cached per
  root. A file equal to disk takes the project's diagnostics (N0301/N0302/N0303, imports, other files' names) and
  `nuclear/transpile` returns its project output; with unsaved changes it is checked alone (no N0106 for names the
  project knows).
- A workspace's marker (`.workspace/workspace.nuc`, `server::is_workspace_marker`) is a manifest: it is checked as
  `nuclear workspace` reads it (`read_calls` of `workspace` and `app`, N0303), never as code (no N0106 for `app`).
- Other files' names: completion, hover ("Declared in …"), go to definition, signature help; their members
  (`Object::Project`) and the named parameters of `Class(`.

## The helpers of the language

The helpers every file has without a `use` (`chunk`, `uniqBy`, `Pair`: ADR-lang-0013) are read from the compiler
(`nuclear_transpile::helpers::public`: each name with its declaration and doc comment) and indexed once, each like
a file of a project (`features::helpers`). `features::outer_decl` answers a name the file does not declare: a
declaration of another file of the project, or else a helper; hover, the named arguments and signature help go
through it, so a helper is shown as a function of the project is.

- Completion offers them wherever it offers the names of the file (signature as detail, doc comment as
  documentation, the label `helper`), after the file's and the project's.
- A name of the file, of its project or of the dialect (`dialect_has`) is never the helper; a key or a named
  argument of that name (`{ tail: 2 }`) neither.
- No go to definition: a helper is inside the compiler, there is no file to open on an installed machine.

## Bundles

The VS Code `.vsix` and the JetBrains zip include `nuclear-lsp`, every dialect of the tree in `server/dialects/`
(each language with its frameworks and type definitions) and each platform's `platform.toml` in
`server/platforms/`. Both packaging scripts end with `nuclear-lsp --check-bundle`, which loads each bundled dialect
and fails on any error (for example N0213); a warning is printed and does not fail (a platform plugin a dialect
does not bring yet, N0305). Zed runs the installed `~/.local/bin/nuclear-lsp`, which finds its
dialects through `nuclear_dialect::install_dir()`. Packaging and releasing belong to `../extensions/`: a change to
the server is released with them.

## Done

`cargo test -p nuclear-lsp` (14 unit tests + 39 server tests) and `cargo clippy --all-targets`.
