---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../../docs/01-product/roadmap.md, ../02-architecture/workspace.md, ../02-architecture/ai-services.md]
---
# Roadmap of the VS Code extension

What is common to the three editors: [the editors' roadmap](../../../docs/01-product/roadmap.md). Each tool has its
own: [Nuclear Builder](../../../tools/nuclear-builder/docs/01-product/roadmap.md),
[HTTP Connections](../../../tools/nuclear-http-connections/docs/01-product/roadmap.md),
[Nuclear Atlas](../../../tools/nuclear-atlas/docs/01-product/roadmap.md),
[the devices](../../../tools/nuclear-device-manager/docs/01-product/roadmap.md).

## Untested

- **0.52.0, the renamed tools** (HTTP Connections, Nuclear Atlas: new command, colour and tool ids): compiled,
  tested (`npm test`) and installed, never opened in a running VS Code.
Done, and never tried in a running VS Code (only headless renders, node checks, HTTP calls and `nuclear-builder`):

- **The Nuclear workspace** (ADR-extensions-0002): the icon theme on the file tree, the editors swapped per
  workspace (a dirty editor stays open), the terminals of build / test / serve and the web commands, the toolbar
  glyphs with an open editor, the tool template pages, the `Ctrl+Alt+<letter>` chords a desktop environment may
  swallow.
- **Editors 0.37**: ◉ Debug of a backend (debugpy, node) and of a web app (chrome attach), the `.nuc` breakpoint
  mirrors under node / chrome / debugpy, build on save for backend and web.
- **Run of a mobile project**: whether VS Code honours `task.allowAutomaticTasks: "on"` (if it asks, document it in
  [the flutter reference §11.1](../../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md)); hot reload in
  Run mode (`noDebug`).
- **The AI pages**: the notifications and the badge, a run or a chat job going on after a tool switch, the regular
  checks' notices, the settings page (Start / Restart against the units, Pull, the MCP buttons against the real
  CLIs, Allow / Deny) and the set-up wizard (the offer at start-up, *Install it for me*, the three-second check,
  *Try again*).

## Pending

- The VS Code listing (`extensions/vscode/README.md`): the example goes in a ```` ```nuclear ```` block; a relative
  image breaks locally and `vsce` rejects it without `repository`. `package.json` `repository` and `bugs` still
  name the old `nuclearlang/nuclear-vscode`: `vsce` rewrites the README's relative links (`../tools/`,
  `../../installer/`, `../docs/03-adr/`) against it, so on the Marketplace they lead to the wrong repository; they
  need the tree (`nuclearlang/nuclear`, `extensions/vscode/`) and a release.
- The development build of the server is not found since the tree changed: `findServer` (`src/extension.ts`) looks
  in `../target/{release,debug}` from the extension's folder, which is `extensions/target/`; the tree's is
  `../../target/`. Its "not found" message still says "in the nuclear repository".
