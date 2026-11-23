# The `dart` dialect

[![ci](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/ci.yml) [![platform-mobile](https://github.com/nuclearlang/nuclearlang/actions/workflows/platform-mobile.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/platform-mobile.yml) · [Website](https://nuclearlang.github.io/dart/reference/dart)

How Nuclear is written in Dart: Dart 3 that passes `flutter analyze` with no warnings. Its framework dialect,
`flutter`, generates the whole app of the [mobile platform](../../../nuclear-synapsis-framework/platforms/mobile/README.md).

## Why

- A Flutter app is mostly layers, state, JSON and wiring; Nuclear holds only the business logic.
- The library is Nuclear's, translated by `library.toml`.
- It leaves the SDK, builds and devices to the `flutter` command, which `nuclear` drives.

## How we made it

- `flutter` generates the app over official libraries (`bloc`, `dio`, `go_router`...) ([ADR-dart-0001](docs/03-adr/0001-flutter-dialect-as-a-framework.md)).
- The platform says what, the dialect says how (ADR-dart-0001).
- Nothing of Dart or Flutter in Rust.
- Imports from type definitions generated from the installed Flutter SDK.

## Try it

```sh
cargo run -q -p nuclear-cli -- build hello.nuc --dialect dart              # List<String> shout(List<String> words)
cargo run -q -p nuclear-cli -- dialect check flutter                       # dialect 'flutter' (flutter → dart) is valid
cargo run -q -p nuclear-cli -- help tutorial                               # a Flutter app from scratch with Synapsis
```

## Read next

- [The tutorial](../../../nuclear-synapsis-framework/docs/08-guides/tutorial.md): an app from scratch.
- The reference: [dart.md](docs/07-reference/dart.md) and [flutter.md](docs/07-reference/flutter.md).
- [How it is built](docs/02-architecture/overview.md) and [what each kind generates](docs/02-architecture/flutter-kinds.md).
- [The other dialects](../README.md). [AGENTS.md](AGENTS.md): to change this dialect.
