# Synapsis mobile

[![platform-mobile](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/platform-mobile.yml) · [Website](https://nuclearlang.github.io/platforms/mobile)

Apps for Android, iOS, desktop and the web, written once in Nuclear and built today with the `flutter` dialect, on
the runtime packages `synapsis` and `synapsis_genkit`.

## Why

- An app carries the same http, JSON, state, session, routes and tests; here it writes only its business logic.
- What the UI toolkit lacks comes from `synapsis`, a package a Flutter developer may also use by hand.
- Left out on purpose: classes that only pass data around, a database for millions of rows.

## How we made it

- The platform is Nuclear only; Flutter is one dialect ([ADR-synapsis-0002](../../docs/03-adr/0002-three-platforms-dialects-under-them.md)).
- `config.nuc` is the manifest ([ADR-mobile-0001](docs/03-adr/0001-project-manifest-packages-and-assets.md)); a screen is `@screen` ([ADR-mobile-0002](docs/03-adr/0002-screens-routes-dialogs-and-splash.md)).
- JSON from the model ([ADR-mobile-0003](docs/03-adr/0003-json-models-names-and-converters.md)); tests in Nuclear ([ADR-mobile-0004](docs/03-adr/0004-tests-in-nuclear.md)).
- The local database is the backend's ORM on the device ([ADR-mobile-0006](docs/03-adr/0006-local-database.md)).
- The onboarding example was made only by `nuclear new` and `gen` ([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## Try it

```sh
nuclear new todos_app -p mobile && cd todos_app
nuclear gen resource todos Todo --source rest:https://jsonplaceholder.typicode.com --path todos \
  --fields "id:int title:string completed:boolean" --screen todos
nuclear build             # the Flutter app in build/app
nuclear device pixel7     # the app in a phone-shaped window, with hot reload
```

## Read next

- [The onboarding](docs/08-guides/onboarding-mobile.md) and [the tutorial](../../docs/08-guides/tutorial.md).
- [The reference](docs/07-reference/mobile.md) and [the runtime's API](docs/07-reference/synapsis.md).
- [AI in an app](docs/08-guides/genkit.md).
- [How each kind comes out in Flutter](../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md). [AGENTS.md](AGENTS.md): to change it.

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
