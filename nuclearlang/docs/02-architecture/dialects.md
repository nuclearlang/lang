---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, emitter-options.md, type-definitions.md, projects.md, ../03-adr/0007-dialects-and-imports.md]
---
# Dialects: format and loading

Read this when you add or change a kind, a decorator, an option or a template of a dialect, a dialect validation,
or how dialects are found. This is a summary for who changes the loader: the full rules are
`docs/07-reference/dialects.md`.

## Files

`dialects/<language>/dialect.toml` (several `.toml` are merged; `docs.toml` is skipped by the loader),
`keywords.toml` (the target's keywords only), `library.toml` (the standard library's translation), `docs.toml`
(the editor documentation), `templates/*.tpl` (referenced as `{ file = "templates/x.tpl" }`). Inheritance with
`extends`/`replaces`. `nuclear spec` prints the contract: which templates exist and the variables of each.

## Where a dialect is found

- A dialect is `dialects/<language>/` or `dialects/<language>/frameworks/<name>/`; its name is the folder's.
  `Loader::load("flutter")` finds it wherever it is; `Loader::available()` lists every one.
- A framework dialect names its platform (`platform = "backend"` in `dialect.toml`, `Dialect.platform`); the
  platform's contract is `platforms/<platform>/platform.toml`, searched in `Loader.platform_paths` (N0305).
  `Loader::default_dialect(platform)` reads the contract's `default_dialect`. What the code generator writes for
  the platform (`[gen]`, `[skeletons]`, `[[generators.<what>]]`) is not in the contract: it is
  `<platform>/generators.toml`, found by `Loader::generators_file(platform)` in `Loader.generator_paths` and merged
  into the loaded dialect with the contract.
- `nuclear_dialect::Home` is where the files are: an install (`$NUCLEAR_HOME/dialects`, `$NUCLEAR_HOME/platforms`
  and `$NUCLEAR_HOME/generators`) or the source tree (`nuclearlang/dialects`, `nuclear-synapsis-framework/platforms`
  and `tools/code_generator/platforms`): `Home.dialects`, `Home.platforms`, `Home.generators`. `homes()` gives the install first, then the tree while it is on disk.
- `Loader::new(search_paths)` adds the `platforms/` and the `generators/` next to each search path; `Loader::of(first, homes)` puts a
  caller's own folders (a flag, a project's `dialects/`) before the homes.
- The command line tool's flags and the server's settings that add search paths are theirs: `../tools/cli/` and
  [language-server.md](language-server.md).

## Kinds (`[kinds.<name>]`)

Fields: `description`, `template`, `overrides` (methods with `@override`), `requires` (required methods,
N0209), `members` (names the kind brings, like `setState`), `param_access`, `imports`, `rename` (e.g.
`{{name}}Controller`), `[kinds.X.syntax]` (templates overridden inside the kind), `named_params`, `inherits`.
Framework fields: `async_methods`, `methods`, `returns`, `file_header`, `alias_via`, `declares`, `provide`,
`results`, `void_methods`. Template variables: `name`, `members`, `body`, `methods_code`, `fields`,
`params_list`, `ctor`, `decorators`, `decor`, `deco_args`, `param_groups`, `ret_info`, `owner_decor`,
`call_args`, `generic_list`, `tinfo`, `plugins`, and on methods `site` and `is` (the full table:
`docs/07-reference/projects.md` §5).

- `fields` carry `decor` (decorators of the field), `decorators` (text of the non-consumed ones) and
  `class_decorator` (first `@PascalCase` without parentheses); `methods` carry `is.<name>`.
- `decor`: an argument that is a list or object also gives its parts (`decor.screen.loggedIn.forward`,
  `decor.screen.providers.items`).
- A kind that would not write generics or interfaces is N0218 (`check_kind_writes`).

## Where a kind comes from (ADR-synapsis-0004)

`Dialect.kind_sources` says the source of each kind: `KindSource::Language`, `Platform(name)` or
`Package { name, version, dialects }`. Kind packages are folders with `kinds/<name>/kind.toml`, searched in
`Loader.packages` (`<project>/kinds`, `<install>/kinds`): `kind_packages`, `kind_package_at`, `apply_packages` (a
package of the dialect's platform becomes a plugin; its `<dialect>/` folder is a layer named after the package),
`Dialect.packages`, `package_gaps` (→ N0306 in `project::check_config`), `extra_docs` (a package's `docs.toml` is
read first).

## Decorators and names

`[decorators] consumed/void`, `[decorators.args]` (argument schema, N0217), `[decorators.provide]
"deco.arg"`, `[names] written/globals`, `public = ["@screen"]`. The Dart `decorator` template writes
`@Name()` for a PascalCase decorator without arguments.

## The standard library

`[library.<base>]` (`dialects/<language>/library.toml`): one template per member, with the receiver and the
arguments (`Dialect.library`, `function_helpers`, `syntax_helpers`; a `helper` is written once per file). The
vocabulary is in Rust: `nuclear_dialect::library` (`MEMBERS`, `BASES`, `OBJECTS`, `WRONG`). Rules:
`docs/07-reference/dialects.md` §5.8; decision: ADR-lang-0009.

## Editor documentation

`base/docs.toml` = the base's `[keywords] [builtins] [types] [tags]` (`nuclear_dialect::base_doc`, compiled in);
`dialects/<language>/docs.toml` and each framework's = `[kinds] [decorators] [words]` (`Dialect::doc`, read on
demand). Markdown in English; a build never reads it. Test `every_dialect_word_has_editor_docs`: every kind,
decorator, modifier and clause has one. Rules: `docs/07-reference/dialects.md` §5.7; decision: ADR-lang-0010.

## Other sections

`[docs]` (`Dialect::docs_url`: API reference links for the editor), `[project] marker`/`output`
(`Manifest::find`), `[call_site.<Module>]`, `[project.manifest]`, `[architecture]` (see
[projects.md](projects.md)). `dart` and `flutter` have no auto-import lists: they come from the type definitions
(`[dialect] defs`).

## Dialects created by agents

Rules, process and restrictions: `docs/07-reference/dialects.md` §8 (ADR-lang-0007); the tutorial:
[create-a-dialect-with-an-agent.md](../08-guides/create-a-dialect-with-an-agent.md); the plan, not started:
[spec 002](../04-specs/002-dialects-with-agents/plan.md) (`dialect new/test`, skill + AGENTS.md, a neutral
platform spec, `[toolchain]`, install from a repository). Per-project kinds: postponed.
