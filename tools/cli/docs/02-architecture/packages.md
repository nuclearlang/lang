---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/docs/02-architecture/build.md, nuclearlang/docs/07-reference/definitions.md]
---
# Packages, type definitions and assets

The code is in `tools/cli/src/framework/`.

## `packages.rs`: a mobile app (`ADR-mobile-0001`)

- `read` (the sections come from the dialect's `[project.manifest]`), `sync` (the `app` / `environment` fields and
  the packages → `build/app/pubspec.yaml` by editing lines; `flutter pub add/remove`; `build/app/.synapsis_deps` =
  the packages that come from `config.nuc`, so only those are removed; it never removes Synapsis's own, `OWN` +
  `PACKAGES`).
- `load_defs`: the version from `pubspec.lock` → `~/.cache/nuclearlang/defs/dart/<p>/<v>`; if missing,
  `generate_defs` runs `dart run bin/defs.dart` of the definitions generator (`nuclearlang/tools/defs`,
  `<install>/tools/defs`) with `--exclude` of the dialect's packages; `Loader::add_defs`; writes `build/defs.lock`;
  skips packages the dialect knows.
- `add` / `remove` (`nuclear flutter add|remove`, also `pub add|remove`): edit `config.nuc` with `set_entry` /
  `remove_entry`, one entry per line; `add` rejects reserved packages (`project::reserved_package`) before running
  flutter; `sync` never adds a reserved one.
- `ensure_config`: `check` and `build` create `config.nuc` if missing (the name, description / version, the app's
  third-party packages; those with a map, `path:` / `git:`, are left out). `template`: the `config.nuc` of `new`.
  `manifest()` takes the name from `app(name)`. `check` only uses cached definitions.

`set_entry` / `remove_entry` open a section written in one line (`one_per_line`) and write a name that is not an
identifier, or is a word of the language, as `"name@value"` (they ask `project::read_config` how a name reads back).

Limits: the pubspec is edited by lines (`set_yaml` / `yaml_get`), not with a YAML parser; versions are text
(`"^2.2.3"`), no `path:` / `git:` yet. A package without `lib/<name>.dart` is described with every file of `lib/`;
types re-exported from another project package repeat (the first wins). `devDependencies` have no definitions.
`generate_defs` prints a long command. `flutter add` runs two builds.

## `dependencies.rs`: backend and web (`ADR-lang-0008`)

`nuclear add|remove <package>` (`package_command` in `framework/mod.rs`; a mobile app goes to `packages::add|remove`, a
folder to the kind packages). Nothing here knows a package manager: every step is a `[toolchain] package_*` command
of the dialect, filled by `fill_command` (`{{tools}}` = `<install>/tools`) and run in the generated project.

- `add`: the generated project installed (`installed`, else `install`); per package: the dialect's advice
  (`[project.manifest.advice]`), `install` (`package_add` with the requirement; the constraint for `config.nuc` is
  the one asked for, or `package_constraint` over `package_version`), its `companion` (`package_companion`:
  `@types/x`), `config.nuc` written after each package, `generate` (`package_defs` into
  `<project>/defs/<language>/<defs_name>/`, replacing another version; `defs_name`: `@nestjs/axios` →
  `nestjs__axios`).
- `remove`: the package and its companion out of `config.nuc` and of the generated project, its `defs/` folder
  deleted.
- `ensure_defs`: after `nuclear install`, the definitions of every dependency that has none (not a folder
  dependency, not a companion); a failure is a line, the install stands.

Limits: no `--dev` (a backend or web manifest has one section); a package is added with the project generated, so
the first `add` of a project that does not compile fails at its build; the Windows commands are written, never run.

## `assets.rs` (`ADR-mobile-0001`)

`write` rewrites `assets:` / `fonts:` / `shaders:` under `flutter:` of the app's pubspec on every build (the rest is
kept; keys are recognized by their 2-space indentation); `fonts` groups `assets/fonts/<Family>/` by the last word of
the name and errors when two files match (`build` and `check` call it before writing). Tested with `flutter build
bundle` (FontManifest and a shader).
