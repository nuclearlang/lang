---
status: in-progress
owner: Julian Molina
updated: 2026-11-23
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

- [ ] The Monitor never yet clicked in a live VS Code (proven on a copy of a real workspace in a headless browser).
- [ ] The installed `nuclear` and the extension: the next release (`installer/install.sh`).
- [ ] The dialects' references (`docs/07-reference/<dialect>.md`) show no `--monitor` equivalence yet.

## Phase 2

- [ ] The report of an app on a phone (Flutter: the VM service's `postEvent`) and in a browser tab (a route of the
      dev server); the Dart runtime without `dart:io` on the web.
- [ ] The Monitor in Android Studio / IntelliJ.

## Phase 3: the automatic Monitor (the user, 2026-11-19 and 2026-11-23)

Done: the console of a project's last run (`nuclear monitor --json` reads the run log: state, requests, errors with
their stack, output), the page on the workspace's selected project with designed states for an end user, *Run and
watch* (the terminal `<project> · monitor`, a device for a mobile app; once by itself), `nuclear monitor --on|--off`
(`.nuclear/monitor/on`, honoured by build, watch and run; `nuclear run` always gives the app the project's report
file), the MCP tool `project_monitor` with the console.

- [ ] The report of a phone's or a browser's app through a collector of the extension (phase 2):
      `extensions/tools/nuclear-monitor/docs/01-product/roadmap.md`.
