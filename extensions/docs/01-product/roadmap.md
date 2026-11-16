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

- Debugging a `.nuc` (ADR-lang-0011, ADR-lang-0011), ▷ Run / Debug, hot reload on save and `nuclear repair`: never
  with a real device or emulator, in VS Code and in Android Studio.
- In a running VS Code, Android Studio and Zed: the project card in the status bar, the hover of a kind with its
  source, the quick pick of dialects (0.28.2), the highlighting of the ADR-lang-0002 operators and of `r"..."`.

## Pending

- **Docs that do not match the code** (found writing the user guides, 2026-11-16): the server has no document
  formatting, only on-type formatting (Enter in a comment), so a whole file is formatted with `nuclear fmt`;
  `vscode/docs/02-architecture/client.md` places ▷ Run / Debug in `editor/title/run`, where `package.json` has
  nothing (the buttons are `nuclear.action.*` in `editor/title`); the flutter reference §11.1 lists old action sets
  for backend and web and says a device panel stops the app after 5 minutes (the code parks it and ends it after 30
  idle, `IDLE_LIMIT`); the Connector suggests `./openapi.yaml` but reads JSON only; `vscode/README.md` leaves out
  `nuclear.trace.server`, `nuclear.debug.followInNuclear` and `nuclear.debug.explainErrors`; the Device and API
  actions have no key.
- **Installers**: the public installers install only the `.vsix`; only `installer/install.sh` from the tree installs
  Zed, and the release ships no JetBrains zip.
- Split the base extension from Synapsis for Flutter (run, debug, device) in VS Code and JetBrains; the framework
  extensions namespaced and activated by the project marker (ADR-extensions-0001, ADR-platform-0002).
- Binaries for other platforms (macOS, Windows) in the packages.
