---
status: accepted
owner: Julian Molina
updated: 2026-11-24
related: [../02-architecture/overview.md, ../../../../../docs/04-specs/015-monitor/tasks.md]
---
# Roadmap of Nuclear Monitor

- **Not clicked by hand for a backend**: its terminal `<app> · monitor` and the header's pick switching the
  workspace's app (proven for a backend in a headless browser and by `test/monitor.test.ts`).
- **Proven in a live VS Code for a web and a mobile app** (2026-11-24, a copy of a real workspace, a separate
  profile on a private display): the web app on the web device and the mobile app on the Synapsis device, measured,
  the strip's tab on the selected app, *Run and watch* (the web device; the device pick), the redraws, their consoles
  (requests, prints, an error with *Open in the code*, connection refused) and their measurements.
  Not proven by hand: the toggle turned on while a phone app runs (it builds and hot-restarts), a web app run in a
  terminal and opened in the person's own browser (measured through the registry's port; its page's console is not
  captured: only the web device has it).
- **A phone app on a real device or an emulator is not measured.** Its runtime (`dialects/dart/templates/monitor.tpl`,
  dart:io) posts the report to the collector when the build has one and no `NUCLEAR_MONITOR_FILE`, but a phone cannot
  reach the editor's 127.0.0.1: the run on an Android device or emulator needs `adb reverse tcp:<port> tcp:<port>`
  of the collector's port (an iOS simulator shares the host's loopback; a real iPhone has no equivalent: the VM
  service's `postEvent`, read by the editor's Dart debug session, is the way there). Its console already reaches
  the log when run from the workspace (Flutter's output).
- **A browser's stack is the served JavaScript's lines**: Vite's transform of a `.ts` shifts lines (imports, types), so
  *Open in the code* of a React page's error lands near the `.nuc` line, not always on it; reading the page's source
  maps (`Debugger.scriptParsed`) would make it exact. Flutter's web errors (`package:app/... 29:9`) land exactly.
- **Connections in a browser** count every request the page opens while a call is open (fetch, XMLHttpRequest; the
  TypeScript runtime also WebSocket): concurrent calls share them, as they share the parent (no async context in a
  browser).
- **A phone app run with `nuclear run` in a terminal**: Flutter keeps the terminal (its keys r, R, q), so only the
  steps reach the run log and the console; run from the workspace (▷ Run, a device), its output is there.
- The Monitor in Android Studio / IntelliJ.
