---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [rules.md, ../03-adr/0004-kinds-and-plugins-are-libraries.md, ../08-guides/kinds.md, ../../platforms/docs/02-architecture/contract.md]
---
# Kinds, kind packages and plugins

How the framework grows without touching the compiler (ADR-synapsis-0004). The normative text is in the language's
reference: `nuclearlang/docs/07-reference/dialects.md` §5.4 (a kind) and §7 (kind packages),
`nuclearlang/docs/07-reference/projects.md` §3.3 (plugins). The user's guide is
[../08-guides/kinds.md](../08-guides/kinds.md). Paths start at the root of the tree.

## Where a kind comes from

| Source | Declared in | Who may use it |
|---|---|---|
| The language's | the language dialect (`dart`'s `data`, `mixin`) | every project of that language |
| Native of a platform | `[platform] kinds` of `platforms/<platform>/platform.toml`, implemented by every dialect of the platform | every project of the platform |
| A kind package | `kinds/<name>/` of a project or of the install | a project of the package's platform that enables it, with a dialect the package implements |
| A project dialect | `<project>/dialects/<name>/` with `extends` | that project, tied to the dialect it extends |

A kind is data: `[kinds.<word>]` plus a template. No kind name is written in Rust. A dialect's own TOML never adds
a kind its platform does not declare (N0305). When a template cannot express something, a generic capability of
the compiler is asked for (an `[options]` entry or a template variable), for every kind.

The loader records the source of every kind in `Dialect.kind_sources` (`KindSource::Language`, `Platform`,
`Package`); the language server shows it in the hover and the completion of a kind (`kind_source` in
`nuclearlang/crates/nuclear-lsp/src/features.rs`).

## A kind package

```
kinds/jobs/
├── kind.toml          [package] name, version, platform, description
├── docs.toml          the editor documentation of its words
├── fastapi/kind.toml  [plugin] (runtime packages, defs, names) + the sections of a dialect and its templates
└── nestjs/kind.toml
```

- It belongs to one platform. The loader applies only the packages of the dialect's platform
  (`Loader::apply_packages`), as a layer named after the package.
- Its implementation for a project is the folder named after the project's dialect, or after a dialect that one
  extends. Without one, the package is a gap (`package_gaps`): N0306 when the project enables it.
- A project enables it with `plugins(<name> = true)` in `config.nuc` and keeps its `synapsis(platform, dialect)`.
- The loader looks in `<project>/kinds/` and in the install's `kinds/`. A platform may ship packages in
  `platforms/<platform>/kinds/`, which the installer copies; none does today.
- `nuclear kind new <name> -p <platform> -d <dialect>` writes the skeleton in the project; `nuclear add <folder>`
  installs a package for every project.

## A plugin

An optional part of a framework that a project carries only when it asks for it.

- A dialect declares it: `[project.plugins.<name>]` with `packages`, `dev_packages`, `defs`, `kinds`, `names`,
  `requires`. The names a platform allows are `[platform] plugins` of its contract, the same in every dialect.
- A project enables it: `plugins(genkit = true, googleAI = true)` in `config.nuc`.
- A kind or a name of a plugin that is not enabled is N0304, with the line to add; an unknown plugin or a value
  that is not `true` or `false` is N0303.
- The generated manifest lists only the packages of the enabled plugins. The runtimes keep the optional parts in
  modules of their own, so a project without a plugin does not need its package.
- Its type definitions are always loaded (their index only), so an editor completes them before the plugin is on.

| Platform | Plugins of its contract |
|---|---|
| `mobile` | `genkit`, `firebaseAI`, `googleAI`, `vertexAI`, `openAI`, `anthropic` |
| `backend` | `sqlite`, `postgres`, `mysql`, `mariadb`, `redis`, `kafka`, `events`, `ai`, `openai`, `ollama`, `chroma` |
| `web` | none |
