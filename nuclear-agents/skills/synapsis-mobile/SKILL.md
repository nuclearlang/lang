---
name: synapsis-mobile
description: Build a Synapsis mobile app (flutter dialect) with the tools: screens, state managers, resources, contracts, devices and builds. Use when a task creates or changes an Android, iOS, desktop or Flutter-web app written in Nuclear.
title: Synapsis mobile
title_es: Móvil con Synapsis
description_es: Construir una app móvil Synapsis (dialecto flutter) con las herramientas: pantallas, gestores de estado, recursos, contratos, dispositivos y compilaciones. Úsalo cuando una tarea crea o cambia una app Android, iOS, de escritorio o Flutter web escrita en Nuclear.
kind: technology
tags: [mobile, flutter, app, screen, statemanager, device, android, ios, synapsis]
base: true
---
# Synapsis mobile

## When to use

A task touches a project whose `config.nuc` says `synapsis(platform = "mobile", dialect = "flutter")`, or asks for
a new app. The mobile and web platforms share their words: a feature reads the same on both.

## Steps

1. **Read first.** `nuclear spec --brief --dialect flutter`, `nuclear help mobile`, `nuclear help onboarding-mobile`,
   and the dialect's sections you need (`nuclear help flutter`). A word: `nuclear help <word> --dialect flutter`.
2. **The machine.** `nuclear doctor` says what is missing; `nuclear setup` installs Flutter step by step. Without
   Flutter the `.nuc` files are still written and `nuclear check` still works.
3. **Create the project** (only for a new one): `nuclear new <name> -p mobile [--org com.example]`. It writes
   `config.nuc`, `main.nuc`, `config/project_config.nuc`, a `home` component and the Flutter app in `build/app`.
4. **Inspect**: `nuclear gen inspect`.
5. **Generate a resource with its screen**: `nuclear gen resource todos Todo --source rest:<base url> --path todos
   --fields "id:int title:string completed:boolean" --screen todos` writes the model and its error, an HTTP
   repository, the use cases, the facade, the screen with its state manager and state model, and a test with the
   repository mocked. The API is ours? Use its contract instead (skill `rest-contracts`).
6. **Make the other pieces**: `nuclear make screen <component> <screen> [--route /path]`,
   `nuclear make statemanager <component> <screen> <name>`, `nuclear make statemodel <component> <screen> <name>`,
   `nuclear make widget <name>`, `nuclear make event <name>`, `nuclear make guard <name>`,
   `nuclear make page <name> --not-found`, `nuclear make test <component>`, `nuclear make integration <name>`
   (aliases with `nuclear g`: `g s`, `g sm`...).
7. **Write what is left**: a use case's rules, what a screen shows, the states a manager emits. Wire a use case:
   `nuclear gen usecase <component> <Name> [--calls <Repository>.<method>]`.
8. **Check**: `nuclear check --json` prints `[]`; then `nuclear analyze` (flutter analyze on the generated app).
9. **Test**: `nuclear test`; on a device, `nuclear test --integration -- -d <device>`.
10. **See it**: `nuclear device pixel7` (a phone in its own window, hot reload; `nuclear device list` for the
    others), `nuclear terminal-device` (inside the terminal), or `nuclear run` on any device Flutter sees.
11. **Ship**: `nuclear build apk|appbundle|ios|ipa|web|macos|linux|windows`.

## The platform's tools

- Views: `stateless`, `stateful`, `@screen(route, providers, loggedIn, acl)`; state: `statemodel`, `statemanager`
  with `@stateModel`, `@state`, `@before`, `@after`.
- Data: `repository` with `@get`/`@post`/`@put`/`@patch`/`@delete`, `@path`, `@query`, `@body`; a model with
  `@primary` gets an encrypted local table; `@repository(saveLocal = true)` gives each GET a `<method>AsLocal()`.
- Domain: `usecase` with `@requires` and `@acl`, `appcomponent`, `service`, `aggregate`.
- Forms: `form`, `formmanager`, `@validate`, rules `@required`, `@email`, `@matches`, `@minLength`...
- AI on the device: plugin `genkit` with `tools`, `chat`, `flow`, `knowledge`, `remote` (`nuclear help genkit`).
- Packages: `nuclear add <package>` (definitions cached in `~/.cache/nuclearlang/defs`), `nuclear remove`.
- When the build or the app fails: `nuclear repair`; a Dart error on its `.nuc` lines: `nuclear explain`.
- `nuclear code` opens the project in VS Code with devices, debugging in `.nuc` and hot reload.
- Examples: `nuclear help example/todos_app`, `example/clean-flutter-project`, `example/tasks_app`.

## Pitfalls

- Editing `build/app` (Dart files): it is regenerated; change the `.nuc`.
- A use case or repository used from a view or from another component: N0301/N0302. Views go through the
  component's facade and a state manager.
- The router or the UI context outside a `stateless` or `stateful`: N0301.
- A state manager method named like the runtime's own members (`emit`, `close`, `state`...): N0223.
- Naming the storage engine or a pub.dev class in platform code: the Nuclear never names the engine; a package's
  names tie that file to the dialect (say so in the project's docs).
- Retries on writes: `@post` is not retried by default; keep it off for anything that must not happen twice.
- Mocks follow this platform's syntax (`when(() => X.method(...)).thenReturnAsync(...)`, `nuclear help flutter` §8),
  which differs from the web's.

## Checklist

- [ ] `nuclear check --json` prints `[]` and `nuclear analyze` finds no errors.
- [ ] `nuclear test` is green; every new state manager has a `@states` test.
- [ ] Screens, managers and models came from `gen`/`make`; nothing under `build/` was edited.
- [ ] No Dart written by hand for a feature; packages added with `nuclear add`.
- [ ] The app was opened on a device (`nuclear device ...` or `nuclear run`) and the changed screen works.
- [ ] The project's `AGENTS.md`, `docs/` and roadmap say what changed.
