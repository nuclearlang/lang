---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0001: A project's manifest is `config.nuc`, it lists only third-party packages, and assets follow a convention

## Context and problem

A project of the platform has only `.nuc` files and `assets/` (ADR-synapsis-0001): the app is generated in `build/app`
and never edited. The app still needs a package manifest: its name and version, the packages it adds, their type
definitions for the transpiler and the editor, and its fonts, shaders and other assets. None of that may be a
hand-written file of the target.

## Decision

**The manifest is written in Nuclear.** `config.nuc`, at the project's root, with the language's call syntax and no
new grammar: `app(name, description, version, usesMaterialDesign)`, `environment(sdk, flutter)`,
`dependencies(package = "version")`, `devDependencies(...)`. It is not transpiled; it is checked with the project
(`N0303`). The mechanism is generic: the dialect's `[project.manifest] file, sections`. The same file carries the
platform and dialect line (ADR-synapsis-0002), the plugins (ADR-synapsis-0004) and the contracts of the backends the app reads
(ADR-synapsis-0006).

**Only third-party packages.** A project adds only packages the framework does not use: neither the dialect's (its
`defs`) nor the ones Synapsis adds (`[project.manifest] reserved`), which reach the app by themselves.
`nuclear add` rejects one before changing anything, and `config.nuc` marks it with `N0303` on its line in
`check`, `build` and the editor. A project without `config.nuc` gets one on its first `check` or `build`.

**Every third-party package has type definitions.** `nuclear add <package>` (the same command as
`nuclear flutter add`, ADR-lang-0008) adds it to `config.nuc` and to the app, and generates its type definitions
with the Dart analyzer (`nuclearlang/tools/defs`) into a global cache, `~/.cache/nuclearlang/defs`, shared by
projects. `nuclear remove` removes it from the project and keeps the cached definitions. The project lists its
own in `build/defs.lock`; the language server loads them from there.

**No empty sections.** What is not used is not written: a new project has only `app(...)`. `add` creates
`dependencies` or `devDependencies` with its first package; `remove` deletes the section with its last one.

**Assets by convention.** `config.nuc` declares no assets. `assets/fonts/<Family>/` are fonts, with the weight and
the style taken from the end of the file's name (`Roboto-BoldItalic.ttf`); `assets/shaders/*.frag` are shaders; any
other folder of `assets/` is bundled. `nuclear build` rewrites `assets:`, `fonts:` and `shaders:` of the app's
pubspec on every build. Two fonts of a family with the same weight and style are an error. The project only adds:
no `dependency_overrides`.

## Options considered

None recorded.

## Consequences

- Positive: a project holds no file of the target; the manifest is checked with the rest of the project, in the
  editor too; the versions of the framework's own packages are never a project's concern; definitions are
  generated once and shared; a deleted asset leaves the app on the next build.
- Negative: a package the framework uses cannot be listed nor pinned by a project. `nuclear defs show` does not see
  a project's packages: a name that gets no import is debugged in `build/defs.lock` and the cache.

## References

- Rules: [project.md](../02-architecture/project.md); the sections one by one, the flutter reference §3.1 and §3.2
  (`nuclearlang/dialects/dart/docs/07-reference/flutter.md`).
- Replaces: ADR-0065, ADR-0066, ADR-0069, ADR-0070, ADR-0071
