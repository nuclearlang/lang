---
status: accepted
owner: Julian Molina
updated: 2026-11-23
related: [../02-architecture/overview.md, ../../../../../docs/04-specs/015-monitor/tasks.md]
---
# Roadmap of Nuclear Monitor

- **Never yet clicked in a live VS Code.** Proven on a copy of a real workspace (a `fastapi` backend: the page's
  HTML drawn from `nuclear monitor --json` of the running app in each state, looked at in a headless browser) and by
  `test/monitor.test.ts`; not proven by hand: the strip's tab opening it on the selected app, the header's pick
  switching the workspace's app, the terminal `<app> · monitor` it starts, the redraws while requests arrive, the
  toggle, *Open in the code*, a mobile app's *Run and watch* through the device pick.
- **The report of an app on a phone or in a browser** (spec 015 phase 2): today only an app with the project's file
  system writes it, so the toggle is off for a mobile or web project (their console works). Planned: the Synapsis
  device is Flutter web (the `chrome` device) and the Dart runtime (`dialects/dart/templates/monitor.tpl`) imports
  `dart:io` (`ProcessInfo.currentRss` throws on the web); a web part of the runtime without `dart:io` (a conditional
  import of a second generated file, e.g. an optional `monitor_runtime_web` template the compiler writes beside
  `nuclear/monitor`: a change of `nuclearlang/crates/nuclear-transpile`), and in the TypeScript runtime a browser
  branch, both posting the report every 2 s (with the original `fetch`, not counted) to a collector of the extension
  (127.0.0.1, a random port, a per-session token, CORS only for the dev server's origin) that writes
  `<project>/.nuclear/monitor/report.json`, so `nuclear monitor --json` stays the only source of hot spots. The
  collector's URL reaches the build through the CLI (`NUCLEAR_MONITOR_URL` → a field of the `Manifest` rendered into
  the runtime), so rebuilds on save keep it. Then: dialect goldens, a real proof (a mobile example on Flutter web
  with the collector receiving a report).
- **A phone app run with `nuclear run` in a terminal**: Flutter keeps the terminal (its keys r, R, q), so only the
  steps reach the run log and the console; run from the workspace (▷ Run, a device), its output is there.
- A web app's console has its dev server's lines (Vite), not the browser's `console.log`: that needs the web
  device's console in the run log.
- The Monitor in Android Studio / IntelliJ.
