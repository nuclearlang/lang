# Synapsis mobile

The mobile platform of Synapsis: apps for Android, iOS, desktop and the web, written once in Nuclear and built
today with the `flutter` dialect. This folder holds the platform's contract (`platform.toml`), its runtime for
Flutter (the `synapsis` package, and `synapsis_genkit` for AI) and its examples.

## Why it exists

Between its screens and its backend an app carries code that is the same in every app: http calls with cache and
retries, JSON mapping, state, the injector, session, access control, events, routes, forms, translations, a local
database, tests. On this platform a project writes only its business logic in Nuclear; the transpiler writes the
constructors, overrides, injection, serialization, http calls, state handling and imports, and what the UI toolkit
lacks comes from the runtime. The `synapsis` package is independent: a Flutter developer may use it by hand.

What it leaves out on purpose: how the target code is written (that is the dialect's), interfaces or classes that
only pass data around (the layers exist in the generated code), translations through a third-party library, and a
local database for millions of rows. A second dialect (`react-native`, `kotlin-multiplatform`) is planned, not
built.

## How we made it

- **The platform is Nuclear only, and Flutter is one dialect of it**
  ([ADR-synapsis-0002](../../docs/03-adr/0002-three-platforms-dialects-under-them.md)); the dialect lives with its
  language, in [`nuclearlang/dialects/dart/`](../../../nuclearlang/dialects/dart/AGENTS.md).
- **The manifest is `config.nuc`**, listing only third-party packages; assets follow a convention
  ([ADR-mobile-0001](docs/03-adr/0001-project-manifest-packages-and-assets.md)).
- **A screen is `@screen`**, navigation belongs to the views, dialogs and the splash come from the runtime
  ([ADR-mobile-0002](docs/03-adr/0002-screens-routes-dialogs-and-splash.md)).
- **JSON is generated from the model** ([ADR-mobile-0003](docs/03-adr/0003-json-models-names-and-converters.md));
  **tests are written in Nuclear** and the build generates the standard ones
  ([ADR-mobile-0004](docs/03-adr/0004-tests-in-nuclear.md)).
- **The local database is the backend's ORM on the device**: `@primary` models, `@repository(saveLocal)`
  ([ADR-mobile-0006](docs/03-adr/0006-local-database.md)).
- Every decision: [docs/03-adr/](docs/03-adr/README.md).

**The onboarding example was made with the tools.** `examples/onboarding/todos_app` was written only by
`nuclear new` and `nuclear gen`, no file by hand
([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)); the website runs those
commands again on every build and fails if they no longer give it.

## Try it

With `nuclear` installed (`nuclear doctor` says what is missing; without Flutter the `.nuc` files are still
written):

```sh
nuclear new todos_app -p mobile
cd todos_app
nuclear gen resource todos Todo --source rest:https://jsonplaceholder.typicode.com --path todos \
  --fields "id:int title:string completed:boolean" --screen todos
nuclear check --json      # []
nuclear build             # the Flutter app in build/app
nuclear test
nuclear device pixel7     # the app in a phone-shaped window, with hot reload
```

Step by step: [docs/08-guides/onboarding-mobile.md](docs/08-guides/onboarding-mobile.md). An app from scratch, with
a component, a repository, a screen and tests: [the Synapsis tutorial](../../docs/08-guides/tutorial.md).

## Where to read next

- The rules of the platform: [docs/07-reference/mobile.md](docs/07-reference/mobile.md); the API of the runtime:
  [docs/07-reference/synapsis.md](docs/07-reference/synapsis.md); the short sheet an agent reads:
  [docs/07-reference/brief/mobile.md](docs/07-reference/brief/mobile.md).
- AI in an app: [docs/08-guides/genkit.md](docs/08-guides/genkit.md).
- How each kind comes out in Flutter: [the flutter reference](../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md).
- What the platform is for: [docs/00-context/vision.md](docs/00-context/vision.md).
- To change it (the runtime, the checks, the goldens): [AGENTS.md](AGENTS.md).

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
