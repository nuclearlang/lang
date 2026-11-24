---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/src/framework/mod.rs, tools/cli/docs/02-architecture/packages.md, nuclearlang/dialects/dart/docs/07-reference/flutter.md]
---
# The build of a mobile app (`nuclear build`, `run`, `test`, `watch`, `repair`, `explain`)

The code is `tools/cli/src/framework/`: `mod.rs` (`build`), `watch.rs`, `explain.rs` and `vscode.rs`. A
backend or web project is not built here: [overview.md](overview.md), "Backend and web projects".

## The pipeline

`nuclear build` leaves the app ready to compile and repeats nothing without changes (~40 ms):

1. Creates the app if missing; syncs `config.nuc` → pubspec and loads the definitions BEFORE transpiling
   ([packages.md](packages.md)).
2. Transpiles the project; writes only what changed and deletes orphans (`.dart_tool/nuclear_files`).
3. `ensure_packages` (Synapsis's own; with `@splash` also `flutter_native_splash`, detected by the line prefix
   `name:`), copies `out.copies`, `assets::write`.
4. `pub get` when the last one was made by another version of the platform (`.dart_tool/nuclear_pub_get` holds the
   version: the runtime package `synapsis` comes with the platform and may need new packages, as 0.100's needs
   `decimal`), when `.dart_tool/package_config.json` is missing (after `flutter clean`) or the pubspec is newer than
   the lock AND than `.dart_tool/nuclear_pub_get` (`pub get` does not touch an unchanged lock).
5. `build_runner --delete-conflicting-outputs` only if a file with `part` changed since
   `.dart_tool/nuclear_build_runner` (`.g.dart` dates are useless: unchanged ones are not rewritten).
6. `flutter_native_splash:create` when the yaml or an image changed (`.dart_tool/nuclear_splash`). Removing `@splash`
   deletes the yaml but leaves the native splash (`flutter_native_splash:remove` needs the yaml: run it by hand
   first).
7. `write_line_map` → `build/app/.dart_tool/nuclear_lines.json` (`BuiltFile::lines`, for the debuggers,
   `ADR-lang-0011`).

## Around it

- Errors in the `.nuc` files → exit code 2 (`CODE_ERRORS`: the editors do not try to repair then); another step
  that fails → 1. `run`, `test` and the devices call Flutter with `--no-pub`: `build` already resolved the packages.
- `repair`: build + analyze → markers deleted + pub get + build → flutter clean + build; each step only if the
  previous one left `flutter analyze` with errors. The editors run it only when something fails.
- `explain`: maps a run-time error to its `.nuc` lines; `--json` for the editors and the Nuclear Builder.
- `watch` rebuilds the whole project and does not see dialect or definitions changes (restart it).
- Flutter is found in `FLUTTER`, `FLUTTER_ROOT`, `.fvm/flutter_sdk` (the project's or above), the PATH,
  `~/fvm/default` and the typical folders (`find_flutter`); `NO_FLUTTER` explains where it looked.

## The VS Code workspace (`vscode.rs`)

`build/<name>.code-workspace` has the Nuclear folder and the Flutter app (the Flutter extension treats the app as a
normal project: devices, F5, hot reload, DevTools), the tasks `nuclear: watch/build/test/analyze` (no problem
patterns: the language server gives the errors; errors of closed `.nuc` files only show in the task's terminal), the
launch entries debug/profile/release with `preLaunchTask`, and `dart.flutterSdkPath`.

- **Do not rename `"<name> (debug)"` nor its `type: "dart"`**: the VS Code extension shows ▷ Run / Debug only if it
  exists, and launches it by name.
- The tasks' `command` is `current_exe()` (with `cargo run` it points to `target/debug`).
- Reload on save relies on `dart.previewHotReloadOnSaveWatcher` (it may cause a double reload with the extension's
  own; it can be removed).
- For a backend or web project the workspace's tasks, launch entries and settings come from the dialect's
  `[toolchain]` (`[[toolchain.launch]]`, `[toolchain.settings]`, `extensions`; ADR-cli-0001).

What a user reads about these commands: the `nuclear` CLI section (§11) of
[the flutter reference](../../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md).
