---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/mobile.md, ../../examples/onboarding/todos_app]
---
# Your first mobile app: a todos list in four commands

An app for Android, iOS, desktop and the web that lists todos from an API, written in Nuclear and built as a
Flutter app. Every file comes from the tools: nothing in it was written by hand. The result is the example
[`examples/onboarding/todos_app`](../../examples/onboarding/todos_app), and the documentation site runs these same
commands again each time it is built, so they always work.

You need `nuclear` installed (`curl -fsSL https://nuclearlang.github.io/install.sh | sh`) and Flutter to build and
run the app (`nuclear doctor` says what is missing; without Flutter the `.nuc` files are still written).

## 1. Create the project

```sh
nuclear new todos_app -p mobile
cd todos_app
```

`config.nuc`, `main.nuc`, `config/project_config.nuc`, a `home` component with its screen, and the Flutter app in
`build/app`.

## 2. Generate the resource and its screen

```sh
nuclear gen resource todos Todo --source rest:https://jsonplaceholder.typicode.com --path todos \
  --fields "id:int title:string completed:boolean" --screen todos
```

The same command as on the web, and the same files: the model and its error, an HTTP repository, the use cases,
the facade, the screen with its state manager and its state model, and a test with the repository mocked. The
mobile and web platforms share their words, so the Nuclear of a feature reads the same on both.

## 3. Check it

```sh
nuclear check --json
```

`[]`: no error.

## 4. Build, test and run

```sh
nuclear build             # the Flutter app: Dart code, pub get, build_runner
nuclear test
nuclear device pixel7     # the app in a phone-shaped window, with hot reload
nuclear run               # or on any device Flutter sees
```

`nuclear code` opens the project in VS Code with its devices, debugging in `.nuc` and hot reload on save.

## Next

- Forms, the local database, events, sessions and Genkit AI: [the mobile reference](../07-reference/mobile.md),
  [Genkit](genkit.md).
- The API behind it, in Nuclear too: the backend onboarding.
