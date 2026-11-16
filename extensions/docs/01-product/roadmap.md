---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../vscode/docs/01-product/roadmap.md, ../../jetbrains/docs/01-product/roadmap.md, ../../zed/docs/01-product/roadmap.md]
---
# Roadmap: what is common to the editors

The pending work of one extension or one tool is in its own `docs/01-product/roadmap.md`. The language server's is
in [the language project](../../../nuclearlang/docs/01-product/roadmap.md).

## Untested

- Debugging a `.nuc` (ADR-lang-0011, ADR-lang-0011), ▷ Run / Debug, hot reload on save and `dragonfly repair`: never
  with a real device or emulator, in VS Code and in Android Studio.
- In a running VS Code, Android Studio and Zed: the project card in the status bar, the hover of a kind with its
  source, the quick pick of dialects (0.28.2), the highlighting of the ADR-lang-0002 operators and of `r"..."`.

## Pending

- Split the base extension from Dragonfly for Flutter (run, debug, device) in VS Code and JetBrains; the framework
  extensions namespaced and activated by the project marker (ADR-extensions-0001, ADR-platform-0002).
- Binaries for other platforms (macOS, Windows) in the packages.
- The tools' code moves out of `vscode/src/` and `jetbrains/src/` into `tools/<tool>/`
  ([spec 008, T4.4](../../../docs/04-specs/008-restructure/tasks.md)).
