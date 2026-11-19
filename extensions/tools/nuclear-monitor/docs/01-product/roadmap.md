---
status: accepted
owner: Julian Molina
updated: 2026-11-19
related: [../02-architecture/overview.md, ../../../../../docs/04-specs/015-monitor/tasks.md]
---
# Roadmap of Nuclear Monitor

- Never yet opened in a live VS Code: the page is tested by `test/monitor.test.ts` and the command by the compile.
- A tool of the Nuclear workspace's strip (beside Nuclear Atlas), not only a command.
- The report of an app on a phone (Flutter: the VM service's `postEvent`) or in a browser tab (a route of the dev
  server): today only an app with the project's file system writes it (spec 015, phase 2).
- The Monitor in Android Studio / IntelliJ.

## The automatic Monitor (the user, 2026-11-19): not started, no file changed yet

The user opened the Monitor from the strip on a mobile (flutter) workspace and got the CLI's raw error ("no
.nuclear/monitor/report.json in <workspace root> or above: run the app with ..."). Verdict: the page must do the
work itself, automatically and backward compatibly, in a new release (editors 0.74.0). Only the reading is done;
what is left:

- The right project: `MonitorPanel.show(project)` receives the workspace's project (`nuclear.workspace.lastProject`,
  as `switchTabs` gives it to the Builder and Atlas), not the active editor's folder or the first workspace folder;
  with several projects the page switches between them.
- Automatic start when there is no report: turn monitoring on and start the app measured, always visibly. Backend
  and web: the terminal `<project> · monitor` with `nuclear run --monitor` (`nuclear install &&` first when
  `isInstalled` is false, as `Workspace.action`), reusing a running one. Mobile: `nuclear.runOnDevice` with the
  monitor on.
- The report from a browser (spec 015 phase 2): the Synapsis device is Flutter web (the `chrome` device) and the
  Dart runtime (`dialects/dart/templates/monitor.tpl`) imports `dart:io` (`ProcessInfo.currentRss` would throw on the
  web). Planned: a web part of the runtime without `dart:io` (a conditional import of a second generated file, e.g.
  an optional `monitor_runtime_web` template the compiler writes beside `nuclear/monitor`), and in the TypeScript
  runtime a browser branch, both posting the report every 2 s (with the original `fetch`, not counted) to a
  collector of the extension (127.0.0.1, a random port, a per-session token, CORS only for the dev server's origin)
  that writes `<project>/.nuclear/monitor/report.json`, so `nuclear monitor --json` stays the only source of hot
  spots. The collector's URL reaches the build through the CLI (`NUCLEAR_MONITOR_URL` → a field of the `Manifest`
  rendered into the runtime), so rebuilds on save keep it.
- Monitoring survives saves and hot reload: `.nuclear/monitor/on` (spec 015 task), honoured by build, watch and run
  until `nuclear monitor --off`; an On/Off toggle on the page ("Measure the app" / "Medir la app").
- The page for an end user: never a path, a command, a backtick, `report.json` or a raw error in the body (those
  only in a collapsible "Details"). Designed states in the HUD style of the strip's tools (corner brackets, `--tc`
  of `.t-monitor`), en/es, light/dark: Starting ("Preparing <project> to be measured…", progress: building,
  installing, opening the device); Measuring without data ("Use the app: each screen and action you try appears
  here.", a live pulse, where it runs in plain words); Data (the accordion plus a header: project, platform,
  "measuring live" / "paused", the toggle); Could not start ("The app did not build", "No device could open", with
  "Try again" and "Show details"); No project ("Open a project"). The strip's `about` of the tool (workspace.ts) as a
  plain sentence ("See which parts of your app are slow while you use it."). Tests per state, including that no path
  or command leaks into the body.
- Backward compatibility: old reports, projects without the flag, the command `nuclear.monitor.open`, the MCP tools
  `project_monitor` / `graph_monitor`; a release fixture for it.
- The rule of AGENTS.md "The page never runs the app nor builds it" is overruled by the user: the page starts the
  measured run itself, always visibly.
- Then: CLI tests, dialect goldens, a real proof (a mobile example on Flutter web with the collector receiving a
  report; the real project citofony read-only but `.nuclear/`), docs, release 0.74.0 and the knowledge base.
