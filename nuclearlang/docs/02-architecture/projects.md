---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [integrations.md, dialects.md, type-definitions.md, language-server.md]
---
# Projects

Read this when you change project builds, `[project]` / `[architecture]` of a dialect, the templates of project
files or the `config.nuc` checks. Rules: `docs/07-reference/projects.md`. Code:
`crates/nuclear-transpile/src/project.rs`.

## The manifest

- `Manifest`: `nuclear.toml`, a `config.nuc` that names `synapsis(platform = ..., dialect = ...)` and
  `app(name = ...)`, or inferred (`Manifest::infer(root, dialect, out)`). `Manifest::read(root)` reads the first
  two; `Manifest::find(path, &dialects)` tries them and then the dialect's `[project] marker`.
- Fields other tools read: `platform: Option<String>`, `version` and `description` (from `app(...)`).
  `project::output_dir(&manifest, &dialect)` gives the output folder (`Manifest.out` is empty for a `config.nuc`
  manifest).

## The build

- `build()`: pass 1 = declarations of every file (`Emitter::declarations`, `ProjectCtx`); pass 2 = emit each
  file with that table. A name of another file is used without `use`: the import is written.
- Result runtime in `nuclear/result`; `[project.files]` templates (`project_context`: `decls`, `kinds.<k>`,
  `decorated.<d>`, `files`, `has.<kind>`, `has.@<decorator>`, `components`, `uses`); a project file whose template
  renders empty is not written; it imports the files whose names its code writes.
- `[project] sources/kinds/files/outputs/assets/marker/output`. Kind by folder (`[project.kinds]`). Assets: text
  files go to `generated`, others to `ProjectOutput.copies` (path → source).
- Output: `Output::lines` / `BuiltFile::lines` (the line map for debuggers); `project::line_map` writes it as
  JSON.
- `build` first turns the contracts the manifest declares into `contracts/<name>/*.nuc` (`contract::sync`). Its
  callers then call `project::write_metadata`, which writes the project's own contract, the project map and the
  project card ([integrations.md](integrations.md)).

## Architecture rules (the linter; ADR-synapsis-0003)

`[architecture]` of a dialect: N0301 (callers, names), N0302 (component privacy), checked by tokens inside each
declaration. Keys: `scope`, `public`, `exempt`, `callers`, `names`. All are errors today.

## `config.nuc` (ADR-mobile-0001)

`[project.manifest] file, sections, packages, reserved`; `project::read_config` (section → arguments as text,
N0303), `check_config` (reserved and dialect packages → N0303; a kind package not implemented for the dialect →
N0306), `reserved_package`. `build` returns the file in `out.files` with an empty `out_path` (writers skip empty
paths).

## The project's packages

`project::project_defs` (a backend or web project's `defs/`), `project::defs_lock` (`build/defs.lock` of a mobile
app), `project::with_project_defs` → [type-definitions.md](type-definitions.md).

## What the language server asks of this module

Optional requests, not done ([roadmap](../01-product/roadmap.md)): `project::build` with the text of the open
files; public `default_kind(dialect, path)` and `ProjectCtx::visible` (the server copied them); the inferred type
of an expression; `render_member` substituting generics.
