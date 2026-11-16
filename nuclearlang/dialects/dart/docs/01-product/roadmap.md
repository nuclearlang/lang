---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/flutter.md, ../05-standards/testing.md, ../06-runbooks/type-definitions.md]
---
# Roadmap of the `dart` dialect

The pending work of `dart` and of its framework dialect `flutter`: only what is about how the output is written in
Dart. A done item is deleted. What is pending of the mobile platform itself (its kinds, its Dart package, its
commands, its devices) is in that platform's roadmap.

## To decide with the user

- **Moving to `material_ui`.** The mobile platform's CI is red since 2026-11-12: the Flutter stable after 3.47.0
  deprecates `package:flutter/material.dart` and `GlobalMaterialLocalizations` for the `material_ui` package.
  `flutter analyze` of `nuclear-synapsis-framework/platforms/mobile/packages/dragonfly` reports 9 infos
  (`deprecated_member_use`) and exits 1. It comes from the Flutter release, not from a change in this tree; the
  local Flutter is older and does not show it. The right fix is moving the runtime, the `flutter` dialect's
  automatic imports, its templates and the Dart type definitions to `material_ui`. Hiding it with
  `--no-fatal-infos` would be a shortcut.

## Pending

- **`hide Page` is written on the wrong import.** It is written on `package:flutter/foundation.dart`: 5
  `flutter analyze` warnings in the example `clean-flutter-project`
  (`nuclear-synapsis-framework/platforms/mobile/examples/examples-flutter-dialect/`); the output did not change
  with the backend data work (ADR-backend-0001). Cause: `hidden_from`
  (`nuclearlang/crates/nuclear-transpile/src/emit.rs`) uses every library of a definitions package
  (`def_libraries`), not the library that exports the name. Fix: the symbol's own library plus `reexports`.
- **`unnecessary_cast` on a typed `Result`.** A `match` over a typed `Result` writes
  `(result as Right<E, T>).value`, which `flutter analyze` reports as `unnecessary_cast`: 6 warnings in
  `character_list_screen` of the user's project `rick_and_morty`. Also 3 infos there
  (`use_build_context_synchronously`, `unintended_html_in_doc_comment`).
