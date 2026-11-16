---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/dependencies.md, ../05-standards/testing.md, ../../../../tools/defs/README.md]
---
# Runbook: the type definitions of Dart (`defs/`)

`defs/<package>/<version>/` (`package.toml`, `index.json`, `api.json`) is generated with the official Dart
analyzer. Never edit it: regenerate it. The generator's own notes:
[../../../../tools/defs/README.md](../../../../tools/defs/README.md); the format:
[../../../../docs/07-reference/definitions.md](../../../../docs/07-reference/definitions.md).

## Regenerate everything

When the Flutter SDK or a package version moves, or the public API of the Dart package `dragonfly` changes.

1. `FLUTTER_ROOT=<Flutter SDK> nuclearlang/tools/defs/generate.sh` (about 45 s). Without `FLUTTER_ROOT` the script
   looks in `~/development/flutter`. It writes, with the installed versions:
   - `dart@<Dart version>`: `dart:core` (implicit), `dart:async`, `dart:math`, `dart:convert`, `dart:collection`,
     `dart:io`, `dart:typed_data`, `dart:isolate`, `dart:developer`;
   - `flutter@<Flutter version>`: `package:flutter/{widgets,material,cupertino,services,foundation,painting,
     rendering,gestures,animation,scheduler,semantics,physics}.dart`, in that order (each name goes to the most
     basic library);
   - `dio`, `get_it`, `json_annotation`, `bloc`, `flutter_bloc`, `go_router`, `connectivity_plus`,
     `flutter_secure_storage`: the main library of each, with the version of `flutter_project/pubspec.lock`;
   - `dragonfly`: `package:dragonfly/dragonfly.dart` and `testing.dart` (the runtime, a path dependency), after
     every package it uses;
   - the `genkit` plugin: `schemantic`, `genkit` (`genkit.dart`, `client.dart`) and `dragonfly_genkit`
     (`dragonfly_genkit.dart`, `testing.dart`).
2. If a version changed, update `defs` in `dialect.toml` (`dart@...`) or in `frameworks/flutter/dialect.toml`
   (also the `defs` of `[project.plugins.genkit]`).
3. `cargo test` from the root of the tree: it validates the dialects, and the goldens show whether an import
   changed.
4. `FLUTTER=$FLUTTER_ROOT/bin/flutter nuclear-synapsis-framework/platforms/mobile/checks/analyze-flutter.sh`: the
   examples under `flutter analyze`.

## Only the runtime, without moving the SDK's definitions

The definitions are of `flutter@3.47.7` while a newer SDK may be installed. To regenerate only `dragonfly` and keep
the others, run `bin/defs.dart` with the `pub dragonfly` line of `generate.sh` and `FV=3.47.7`.

## A new pub.dev package

When the generated code extends or imports a class of a package the dialect does not know, the module is left
open: no `@override` and no check of undefined names. The fix is to give the dialect its definitions:

1. Add it to the host project: `(cd nuclearlang/tools/defs/flutter_project && $FLUTTER_ROOT/bin/flutter pub add <package>)`.
2. Add its line at the end of `generate.sh`, with the `--depends` / `--exclude` of the packages it depends on (as
   `flutter_bloc` does).
3. Generate it and name it in the `defs` of the dialect that uses it.

## One package: `bin/defs.dart`

```sh
dart run bin/defs.dart --project <dir> --out <package folder> --name <n> --version <v>
    [--description <text>] [--depends <n@v>]... [--implicit <library>]... [--exclude <folder>]...
    <library>...
```

- `--project`: the folder whose `package_config` resolves the libraries (`.` for Dart's, `flutter_project` for
  `package:flutter/...` and the pub packages).
- `--exclude`: packages already generated (the dependencies): their declarations are not repeated and their
  libraries count for `reexports`.
- `--implicit`: libraries that are always visible (`dart:core`).

## A project's own packages

Nothing here changes. A mobile project's `dependencies` get their definitions from the same `bin/defs.dart`, with
`--project build/app`, the version of the app's `pubspec.lock` and `--exclude` of the dialect's packages, into the
cache `~/.cache/nuclearlang/defs/dart/`; the project lists them in `build/defs.lock`. A dependency's library the
app cannot resolve (a plugin it has not enabled) is skipped, not an error.
