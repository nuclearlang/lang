---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../../../docs/01-product/roadmap.md, ../02-architecture/workspace.md, ../02-architecture/ai-services.md]
---
# Roadmap of the VS Code extension

What is common to the three editors: [the editors' roadmap](../../../docs/01-product/roadmap.md). Each tool has its
own: [Nuclear Builder](../../../tools/nuclear-builder/docs/01-product/roadmap.md),
[HTTP Connections](../../../tools/nuclear-http-connections/docs/01-product/roadmap.md),
[Nuclear Atlas](../../../tools/nuclear-atlas/docs/01-product/roadmap.md),
[the devices](../../../tools/nuclear-device-manager/docs/01-product/roadmap.md).

## Untested

- **0.79.0, the workspace's action buttons, the backend scripts and the first build** (reported from a new Mac: a
  backend project in Cursor showed no play and no tasks): compiled, `npm test` (the scripts' list), installed in
  Cursor, where the *Nuclear Scripts* view shows in the explorer; the buttons under the project's name, a ▷ of the
  view and ◉ Debug building a never-built project were not clicked in a running editor (no input tool on this
  machine). The store page (`README.md` with the website's screenshots, `repository`, `homepage`, `bugs`,
  `galleryBanner`) is packaged by `vsce` with no warning, not yet seen on the stores.

- **The language button (Unreleased, spec 011 T5.13)**: compiled, tested (`npm test`), the Builder page and the
  company screen rendered headless in English and Spanish with the globe's menu open; never clicked in a running
  VS Code (the re-render of every open page, the status bar item, Nuclear Chat registered again). A WebSocket panel
  re-rendered by a change of language shows its open sockets as closed until they are reconnected.
- **0.58.0, the welcome over every setting, the squad screen, the settings by section and the Spanish**: compiled,
  tested (`npm test`), rendered headless in English and Spanish with the real roster and teams; never opened in a
  running VS Code (the migration of the moved settings neither).
- **0.52.0, the renamed tools** (HTTP Connections, Nuclear Atlas: new command, colour and tool ids), and **0.52.2,
  the ports the set-up chooses**: compiled, tested (`npm test`), packaged and installed (0.52.2), never opened in a
  running VS Code.
- **0.53.0 and 0.53.1** (0.53.1: only the bundled dialects). **0.53.0, the set-up page and the settings page over `nuclear-builder setup`** (the plan, the steps as JSON
  lines, `--status --json`, `--restart`, `--set`): compiled and packaged; the commands they run were tried in a
  terminal (`--plan --json`, `--status --json`, a whole set-up), the pages never opened in a running VS Code.
Done, and never tried in a running VS Code (only headless renders, node checks, HTTP calls and `nuclear-builder`):

- **The Nuclear workspace** (ADR-extensions-0002): the file tree drawn like the explorer (the twistie, the indent
  guides, the keyboard, the reveal of the active editor's file, the redraw after a build), the editors swapped per
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
  image breaks locally and `vsce` rejects it without `repository`. `package.json` names the tree
  (`nuclearlang/lang`, directory `extensions/vscode`); whether `vsce` rewrites the README's relative links
  (`../tools/`, `../docs/03-adr/`) against that directory was not tried: package once and read the listing.
- The development build of the server is not found since the tree changed: `findServer` (`src/extension.ts`) looks
  in `../target/{release,debug}` from the extension's folder, which is `extensions/target/`; the tree's is
  `../../target/`. Its "not found" message still says "in the nuclear repository".
