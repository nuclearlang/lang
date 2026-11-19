---
status: in-progress
owner: Julian Molina
updated: 2026-11-19
related: [requirements.md, design.md]
---
# Spec 015: Nuclear Monitor — Tasks

## Phase 1: the measurement, the report, the editor (done but the items below)

Done: `Manifest.monitor` and `monitor_body` / `monitor_runtime` in the compiler (test
`the_monitor_measures_each_function_only_when_asked`, the goldens unchanged); the three runtimes; `--monitor` in
`build` and `run`; `nuclear monitor [--json]`; the VS Code tool `extensions/tools/nuclear-monitor/`; the MCP tools
`project_monitor` and `graph_monitor`; the Smart Graph's `strategy:bug-slow`. Proven by runs: a project in
`typescript` (Node.js), `python` and `dart` (the tree, concurrent awaits under their parent, sockets and HTTP
counted); `nestjs-check`, `fastapi-check` and `react-check` green with the monitor on (tsc --strict, pyright
--strict, the tests, the live runs, the bundles); the mobile example under `flutter analyze` with no issues.

Left:

- [ ] A save in the editor (`buildOnSave`, `nuclear watch`) builds without the monitor: the measured app loses its
      wrappers at the next reload. The project should remember it (`.nuclear/monitor/on`) until `nuclear monitor
      --off`.
- [ ] The Monitor never yet opened in a live VS Code; not yet a tool of the workspace's strip.
- [ ] The installed `nuclear` and the extension: the next release (`installer/install.sh`).
- [ ] The dialects' references (`docs/07-reference/<dialect>.md`) show no `--monitor` equivalence yet.

## Phase 2

- [ ] The report of an app on a phone (Flutter: the VM service's `postEvent`) and in a browser tab (a route of the
      dev server); the Dart runtime without `dart:io` on the web.
- [ ] The Monitor in Android Studio / IntelliJ.

## Phase 3: the automatic Monitor (the user, 2026-11-19; not started)

- [ ] The page uses the workspace's project, starts the measured run itself (terminal or device, always visible),
      receives a browser's report through a collector of the extension, keeps the monitor on with
      `.nuclear/monitor/on`, and shows designed states for an end user (no path, command or raw error in the body).
      The full list: `extensions/tools/nuclear-monitor/docs/01-product/roadmap.md` ("The automatic Monitor").
