---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [05-standards/testing.md, 02-architecture/dependencies.md, 07-reference/dragonfly.md, 01-product/roadmap.md]
---
# Change an example, change the runtime, publish a package

Commands run from the root of the tree unless a step says otherwise.

## An example's output changed

After a change of an example, of the contract or of what the dialect writes:

1. `UPDATE_GOLDEN=1 cargo test`, and review the diff of `examples/expected/` and of the `.dart` goldens.
2. `python3 nuclear-synapsis-framework/platforms/mobile/checks/spec-check-dragonfly.py --fix`: the Dragonfly
   blocks of the flutter reference are rewritten from the example project.
3. `cargo test && cargo clippy --all-targets`.

## The public API of a runtime package changed

1. In the package: `flutter pub get && flutter test && flutter analyze`.
2. Regenerate its type definitions, which the transpiler and the editor read:
   `FLUTTER_ROOT=<flutter sdk> nuclearlang/tools/defs/generate.sh` writes
   `nuclearlang/dialects/dart/defs/{dragonfly,dragonfly_genkit}/<version>/` with every other package of the
   `dart` language. The generator is the language project's:
   [its README](../../../../../nuclearlang/tools/defs/README.md).
3. When the installed Flutter is newer than the definitions of the toolkit (`flutter@3.47.7` today), regenerate
   only `dragonfly` without moving the others: run `bin/defs.dart` with `FV=3.47.7`, as the `pub dragonfly` line
   of `generate.sh` does.
4. If a version changed, the `defs` list of the dialect's `dialect.toml` changes with it.
5. `cargo test`: the goldens show whether an import changed.
6. Update the API reference, [dragonfly.md](../07-reference/dragonfly.md), and the package's `CHANGELOG.md`.
7. `installer/install.sh`, so the installed commands get the change.

## Publish `dragonfly`

```sh
cd nuclear-synapsis-framework/platforms/mobile/packages/dragonfly
flutter analyze && flutter test
dart pub publish --dry-run
```

The package was never published; what is left before it can be is in the
[roadmap](../01-product/roadmap.md). `dragonfly_genkit` is `publish_to: none`.
