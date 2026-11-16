---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [client.md, ../01-product/roadmap.md]
---
# Debugging a `.nuc` (`src/debug.ts`)

A debugger only knows the generated file. `debug.ts` keeps the `.nuc` in front of the developer on top of the
debug session of each dialect (ADR-lang-0011, ADR-lang-0011). Never tried with a real device
([roadmap](../../../docs/01-product/roadmap.md)).

## The line map

- `<app>/.nuclear/lines.json`: written by every `nuclear build` of a project.
- `build/app/.dart_tool/nuclear_lines.json`: written by `dragonfly build` of a mobile app; for each generated
  `.dart`, its `.nuc` and the pairs (dart line, nuc line).

`toDart` / `toNuc` translate a place; `built()` reads the map again after each build.

## Every dialect

The tracker is registered for `DEBUG_TYPES`: dart, node, pwa-node, chrome, pwa-chrome, msedge, debugpy, python.
Each `.nuc` breakpoint is mirrored with the project of its own file (`find(dir)`). The explanations of run-time
errors are Dart-only.

## What it does

- **Mirror breakpoints**: a breakpoint in a `.nuc` gets one in the generated file (the ids in `mirrors`; the places
  in `workspaceState`, to delete the ones VS Code restores).
- **The paused line**: `stopped` → `stackTrace` → the `.nuc` line highlighted (`showPaused`, in the editor group to
  the left of the paused generated file).
- **Errors (Dart)**: an exception, or an error block in the `output`, → `dragonfly explain --json` → a diagnostic
  `dragonfly-runtime` at the `.nuc` line (Problems panel) and the webview *Nuclear: runtime error*, with the Nuclear
  call stack and the original Dart error.
- **Mixed debugging**: `nucStep` for F10 / F11 / Shift+F11 when `nuclear.pausedInNuc && (editorLangId == nuclear ||
  nuclear.nucStepping)`: it repeats `next` / `stepIn` while the `.nuc` line and the stack depth do not change (at
  most 200 times). `showValues` (the values of variables in the `.nuc`), `hover`
  (`EvaluatableExpressionProvider`), the view `nuclear.callStack`, `nuclear.debug.otherSide` (*Go to the Same Line in
  the generated code*), `openPlace`.

Settings: `nuclear.debug.followInNuclear`, `nuclear.debug.explainErrors`.

## The web device

◉ Debug of a web project starts a `chrome` attach session on the web device's CDP port with `webRoot` = the app, so
the same mirrors put a `.nuc` breakpoint into the generated `.ts`
([the device manager](../../../tools/nuclear-device-manager/docs/02-architecture/web-device.md)).
