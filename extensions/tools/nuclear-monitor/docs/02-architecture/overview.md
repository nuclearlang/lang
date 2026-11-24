---
status: accepted
owner: Julian Molina
updated: 2026-11-24
related: [../../AGENTS.md, ../../../../../docs/04-specs/015-monitor/design.md]
---
# How the run log and the report reach the page

```
nuclear run (terminal)  ─┐  each step, the build's errors, the server's output (a line per request, the cause and
the editor's devices    ─┴► stack of each 500), exited:/failed:  ──►  <project>/.nuclear/logs/run.log
the web device, the Synapsis device ─► the page's requests, prints and errors (CDP: browser-log.ts) ──► run.log
nuclear run --monitor, or nuclear monitor --on (.nuclear/monitor/on, honoured by build, watch and run)
        └► the app measured ──► NuclearMonitor writes <project>/.nuclear/monitor/report.json every 2 s and at exit
           an app in a browser (or on a phone) ──POST every 2 s──► the collector (collector.ts; nuclear run's
           own without the editor) ──► <project>/.nuclear/monitor/report.json

FileSystemWatcher **/.nuclear/logs/run.log, **/.nuclear/monitor/report.json (debounced 300 ms) + every 2 s while
visible ──► MonitorPanel.refresh ──► nuclear monitor --json --project <project> ──► page() once, then parts()
```

- **The project**: `MonitorPanel.show(root)`; the workspace's strip passes its selected project
  (`nuclear.workspace.lastProject`, as for the Builder), the command without one takes the active `.nuc`'s project
  (`projectAt`: the folder of `main.nuc`, `config.nuc` or `nuclear.toml`), then the workspace's selected one. The
  header's pick switches among the workspace's apps and selects that app in the workspace too.
- **What the CLI gives** (`nuclear monitor --json`): the report's keys as before (empty without a report),
  `project`, `measuring` (the flag) and `console`: `state` (`none`, `starting`, `running`, `stopped`, `failed`),
  `step`, `url`, `why`, the counts and `lines` (the last run, from its last `--- ` line, the newest 1000), each
  `request` (method, path, status, ms), `error` (text, the request's method and path when it is one, `stack`),
  `step`, `reload`, `end`, `failed` or `output`. A run with an address is `running` only while the address answers.
- **The page's states** (`stateOf`): no project; the command failed; not running (`none`, `stopped`: *Run and
  watch*, the last run's lines under it); starting (the steps done and the current one); running without a request
  yet (a backend or web app: "Use the app"); data; could not start (a title by the step it stopped in, *Try again*,
  *Show details*). The parts are redrawn by a message: the open errors, the filter, the tab and the scroll at the
  bottom are kept.
- **Run and watch**: a running or starting project is only shown. Otherwise a backend runs in the terminal
  `<project> · monitor` (`nuclear monitor --on && nuclear run`; `nuclear run` installs the packages itself); a web
  app is measured (`nuclear monitor --on`) and opened on the web device (`nuclear.webDevice.open`), whose page's
  console reaches the log; a mobile app is measured and goes to the workspace's ▷ Run (the pick of a device; outside
  a workspace, `nuclear.run`). The page does it once by itself per project and window when it opens on a project
  that is not running (not for a mobile app: the device is a choice).
- **The toggle** runs `nuclear monitor --on|--off`; a running app is built again so its reload is measured (or no
  longer): a server reloads, a web app's dev server reloads the page, a phone app is hot-restarted.
- **The collector** (spec 015 phase 2): `activateMonitor` starts one per window (127.0.0.1, a random port, a token)
  and gives its address to every process of the window and its terminals as `NUCLEAR_MONITOR_URL`; a measured build
  writes it, with the project's key (FNV-1a of its folder, `projectKey` = the CLI's `project_key`), into the
  runtime (`http://127.0.0.1:<port>/<token>/<key>`), so a rebuild on save keeps it. A browser's runtime posts its
  report there with the page's own `fetch` (not counted); the collector checks the token, finds the project by its
  key (told by the page or a device with `allow`, else the registry `nuclear projects --json`), takes a request only
  from the app's origin (a device's page, or the registry's port on this machine; a phone's app sends none),
  answers CORS for that origin only, and writes the report whole. Without the editor, `nuclear run --monitor` of a
  web or mobile app runs a collector of its own (`tools/cli/src/framework/collector.rs`).
- **A device's console**: the web device follows its page (console, exceptions, `Network.*`), the Synapsis device
  only the requests (Flutter's output already carries the prints and errors); `browser-log.ts` writes them as the
  run log's lines (`GET http://… 200 12ms`, `ERROR GET http://… net::ERR_CONNECTION_REFUSED`, `ERROR Uncaught
  TypeError: …` with its frames relative to the app), leaving out the page's own files, a framework's fonts and
  assets, and the collector's posts. A device that stops writes `exited: 0`.
- **A click** on an error's *Open in the code* opens the `.nuc` line the error names (`--> components/a.nuc:11:9` of
  a build error), else the innermost frame of `nuclear explain --json` (the build's line map); a click on a name of
  the measurements opens `<project>/<path>` at its line.
- The measurements tree: one `<details>` per node, open for the first two levels and for every flagged node; the
  bar's length is the node's time against the longest root, its darker part the own time.
