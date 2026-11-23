---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../05-standards/testing.md, ../../../docs/02-architecture/kinds-and-plugins.md, ../../../docs/03-adr/0002-three-platforms-dialects-under-them.md]
---
# The contract of a platform: `platform.toml`

`<platform>/platform.toml` says what every dialect of the platform must implement, identically. It is data read by
the compiler's loader; nothing in it names a language. The normative description of each key, with the values a
generator template gets, is `nuclearlang/docs/07-reference/dialects.md` §1. Paths that start with `nuclearlang/`
or `tools/` start at the root of the tree.

## Sections

| Section | Holds | Read by |
|---|---|---|
| `[platform]` | `name` (must be the folder's and the one the dialect names), `description`, `default_dialect` (what `nuclear new -p <platform>` uses without `-d`), `kinds`, `decorators`, `plugins` | the loader's check (below) |
| `[decorators.args]` | decorator → its named arguments (`!` = required), the same in every dialect; a dialect's own entry wins | N0217 |
| `[decorators.fields]` | decorator → the rule a field with it must meet: `optional`, `list`, `target`, `sibling`, `inverse`, `with` | N0308 |
| `[decorators.replaced]` | a removed decorator → what replaces it | N0309 |
| `[layout]` | kind → the path of its file, with `{component}`, `{screen}` and `{file}` (the name in snake_case) | `nuclear help layout --dialect <d>`, `nuclear make`, `nuclear gen`, agents |
`decorators` is the list of the `@words` a project may write: one in lower case that is not in it is N0309 in a
project of the platform. The web contract has no `[decorators.*]` tables.

## What the code generator writes: not in the contract

What `nuclear make` and `nuclear gen` write for a platform is the code generator's, in
`tools/code_generator/platforms/<platform>/generators.toml` (`tools/code_generator/AGENTS.md`). The loader reads it
with the contract (`Loader::generators_file`, from `Home.generators`; `<install>/generators/` in an install):

| Section | Holds | Read by |
|---|---|---|
| `[skeletons]` | kind → the smallest file of the kind that compiles, with `{{Name}}`, `{{name}}`, `{{component}}`, `{{Component}}`, `{{table}}` | `nuclear make <kind> <component> <Name>` |
| `[gen]` | how a generator writes an `Http` connection (`http`, `http_named`) | `nuclear gen` |
| `[[generators.<what>]]` | the files `nuclear gen <what>` writes (`component`, `resource`, `usecase`), in order: `kind`, `name`, `template`, and `when`, `each`, `merge` | `nuclear gen` |

The mobile file has no `[skeletons]`.

## How a dialect implements it

A framework dialect is a folder `nuclearlang/dialects/<language>/frameworks/<dialect>/` (`dialect.toml`,
`docs.toml`, `templates/`). Its `[dialect]` table names the language dialect it extends and its platform:

```toml
[dialect]
name = "fastapi"
platform = "backend"
extends = "python"
```

It then gives each kind of the contract a `[kinds.<word>]` with its template, lists the decorators its templates
read (`[decorators] consumed`), declares the platform's plugins (`[project.plugins.<name>]`), the architecture
rules (`[architecture]`) and what the `nuclear` command runs (`[toolchain]`). A project dialect that extends it
inherits the platform.

## What the loader checks

`check_platform` in `nuclearlang/crates/nuclear-dialect/src/model.rs` runs when a dialect that names a platform is
loaded. Every finding is the diagnostic N0305; an error means the dialect does not load.

| Case | Result |
|---|---|
| The dialect names a platform without a `platform.toml` in the loader's platform folders | error |
| The file is not valid TOML, has no `[platform]`, or its `name` is not the platform the dialect names | error |
| The dialect misses a kind of `kinds` | error |
| The dialect adds a kind that is not in `kinds` (the language dialect's own kinds, such as `dart`'s `mixin`, do not count) | error |
| The dialect consumes a decorator that is not in `decorators` | error |
| The dialect declares a plugin that is not in `plugins` | error |
| `[layout]` names something that is not a kind of the platform | error |
| `[skeletons]` or a `[[generators.<what>]]` of the platform's `generators.toml` names a kind with no place in `[layout]`; a generator's `name` or `template` does not compile (`load_generators`, same file) | error |
| The dialect does not bring a plugin of `plugins` yet | warning of `nuclear dialect check` and the bundle check (a build is silent); an error in a project that enables it |

The loader also copies the platform's data into the loaded dialect, so every tool reads it from one place:
`platform_decorators`, `decorator_args`, `decorator_fields`, `replaced_decorators`, `layout` from the contract;
`skeletons`, `generators`, `gen_values` from the generators file.

The contract is found by `Loader::platform_file`: the first `<platform>/platform.toml` of `Loader.platform_paths`,
which are the `platforms/` folder next to each dialects folder and the `platforms` of each home (the install, then
the source tree). The generators file is found the same way by `Loader::generators_file`: the first
`<platform>/generators.toml` of `Loader.generator_paths`.

## Changing a contract

1. A new kind, decorator or plugin is written in `[platform]` first; a kind also gets its `[layout]` path (a test
   requires one for every kind) and, where the platform has them, a `[skeletons]` entry in its `generators.toml`.
2. Every dialect of the platform implements it in the same change, or the loader refuses the dialect that does
   not. A plugin is the one thing a dialect may bring later (a warning).
3. Every new word gets its editor documentation in the dialect's `docs.toml` (a test requires it), and the
   platform's reference (`<platform>/docs/07-reference/<platform>.md`) gets the rule, in Nuclear only.
4. The examples and their goldens follow: [testing.md](../05-standards/testing.md).

A kind that only one project or one community needs is not added to a contract: it is a kind package
(`nuclear-synapsis-framework/docs/02-architecture/kinds-and-plugins.md`).
