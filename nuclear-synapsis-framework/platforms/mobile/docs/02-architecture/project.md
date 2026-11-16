---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [07-reference/mobile.md, 03-adr/0001-project-manifest-packages-and-assets.md, 02-architecture/kinds.md]
---
# A project of the platform

The normative text is [mobile.md §1 and §4](../07-reference/mobile.md); how the dialect turns each part into the
app is the [flutter reference §3](../../../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md).

## Only `.nuc` files and `assets/`

A project has only `.nuc` files and `assets/` (ADR-synapsis-0001). No `nuclear.toml`: the project's name is its folder.
Everything generated goes to `build/` (the app in `build/app`) and is never edited.

## Layout

```
main.nuc  config.nuc
config/                              appConfig
shared/                              widgets events models converters components guards screens
components/<c>/<c>_component.nuc     the facade
components/<c>/config/  data/
components/<c>/domain/               models usecases aggregates services
components/<c>/presentation/<screen>/   the screen, managers/ state_models/ forms/
components/<c>/presentation/widgets/
components/<c>/ai/                   tools, flow, chat, knowledge (plugin genkit)
assets/i18n/<locale>/  assets/splash/
test/  integration_test/
```

The exact file of each kind is `[layout]` of `platform.toml` (`nuclear help layout --platform mobile`).

**Kind by folder:** a declaration without a header word in `models/`, `state_models/`, `forms/`, `test/` or
`integration_test/` takes its folder's kind. What is in `test/` is visible only to the files of `test/`.

## `config.nuc`

The only manifest of a project ([ADR-mobile-0001](../03-adr/0001-project-manifest-packages-and-assets.md)), written
with the language's call syntax. It is not transpiled; its errors are `N0303`.

| Line | What |
|---|---|
| `dragonfly(platform = "mobile", dialect = ...)` | the platform the project is written for and the dialect it is built with (ADR-synapsis-0002) |
| `app(...)` and the sections of the app's package manifest | the dialect's: their names and arguments are in the flutter reference §3.1 |
| `plugins(genkit = true, ...)` | the optional parts; a kind or a class of a plugin not enabled is `N0304` |
| `dependencies(package = "version")`, `devDependencies(...)` | third-party packages only |
| `contracts(name = "path or url")` | a backend's contract: `contracts/<name>/` is generated at every build (ADR-synapsis-0006) |

- An empty section is not written: a new project has only the app.
- Only third-party packages the framework does not use. The dialect's and Dragonfly's own are added by themselves
  and are visible in the generated app's manifest; listing one is `N0303` on its line and `dragonfly add` rejects
  it before changing anything.
- A project without `config.nuc` gets one on its first `check` or `build`.

## Assets by convention

No assets section. `assets/fonts/<Family>/<Family>-BoldItalic.ttf` is a font (weight and style from the end of the
name; `Oblique` is italic; two files with the same weight and style are an error); `assets/shaders/*.frag` are
shaders; any other folder of `assets/` is bundled. The app's manifest is rewritten from the files on every build.
The project only adds: it overrides no dependency.

## Type definitions of a project's packages

Each dependency gets type definitions generated once into `~/.cache/nuclearlang/defs` and listed in
`build/defs.lock` (imports, overrides, hover). The editor uses the same lock. Debugging a name of a package that
gets no import: look at `build/defs.lock` and the cache; `nuclear defs show` does not see them.

## Architecture rules

The transpiler checks the dialect's `[architecture]` across the whole project (ADR-synapsis-0003;
[projects.md §4](../../../../../nuclearlang/docs/07-reference/projects.md)). All are errors; the editor shows them.

| Rule | Code |
|---|---|
| Who calls whom: `usecase` ← `appcomponent`; `service` ← `usecase` or `aggregate`; `aggregate` ← `usecase`; `repository` ← `usecase` or `aggregate` | `N0301` |
| The UI toolkit's context and router only in views (the names are the dialect's `[architecture.names]`) | `N0301` |
| Closed components: from another component only the `appcomponent`, models, converters, events, global components, guards and screens are visible | `N0302` |
| Tests may use everything | — |

The app has one injector; privacy is checked by the transpiler, not by the runtime. The open questions of the
linter (warnings, disabling a rule, new rules) are in the
[framework's roadmap](../../../../docs/01-product/roadmap.md).
