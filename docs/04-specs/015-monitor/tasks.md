---
status: in-progress
owner: Julian Molina
updated: 2026-11-24
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

## Phase 2: an app in a browser or on a phone

Done (2026-11-24, "Monitor for everything"): the report of an app in a browser through a **collector** (the
editor's, `extensions/tools/nuclear-monitor/src/collector.ts`; `nuclear run --monitor`'s own without the editor,
`tools/cli/src/framework/collector.rs`), not a route of the dev server: 127.0.0.1, a random port, a token, the
project's key, CORS only for the app's origin, the report written to the project, so `nuclear monitor --json` stays
the only source of hot spots. Its address reaches the build as `NUCLEAR_MONITOR_URL` → `Manifest.monitor_url` → the
runtime's `url` (rebuilds on save keep it). The Dart runtime is its own host where dart:io works and imports
`monitor_web.dart` (the optional template `monitor_runtime_web`, a second generated file) in a browser, with a
conditional import of itself; the TypeScript runtime posts from its browser branch. The console of a page (the web
device: console, errors with their stack, requests; the Synapsis device: requests) in the run log
(`extensions/tools/nuclear-device-manager/src/browser-log.ts`), Flutter's web errors read with their frames. The
Monitor's toggle and *Run and watch* for web and mobile apps. Proven in a live VS Code on a copy of a real workspace
(fastapi, react on the web device, flutter on the Synapsis device).

- [ ] A phone app on a real device or an emulator: its dart:io runtime posts to the collector, but the phone does not
      reach 127.0.0.1 (`adb reverse` for Android; the VM service's `postEvent` for iOS):
      `extensions/tools/nuclear-monitor/docs/01-product/roadmap.md`.
- [ ] The Monitor in Android Studio / IntelliJ.

## Phase 3: the automatic Monitor (the user, 2026-11-19 and 2026-11-23)

Done: the console of a project's last run (`nuclear monitor --json` reads the run log: state, requests, errors with
their stack, output), the page on the workspace's selected project with designed states for an end user, *Run and
watch* (the terminal `<project> · monitor`, a device for a mobile app; once by itself), `nuclear monitor --on|--off`
(`.nuclear/monitor/on`, honoured by build, watch and run; `nuclear run` always gives the app the project's report
file), the MCP tool `project_monitor` with the console.

