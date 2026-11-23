---
status: accepted
owner: Julian Molina
updated: 2026-11-23
related: [../../README.md]
---
# Nuclear Monitor

Nuclear Monitor shows what your app is doing while it runs: every request, every error with the line of your code
it came from, every message the app prints, and which parts are slow.

1. In the Nuclear workspace choose the app, then the strip's **Monitor** (`Ctrl+Alt+F`). From the command palette:
   *Nuclear: Open Monitor* (the app of the open `.nuc`, else the workspace's app). With several apps, the header's
   *Project* switches between them.
2. If the app is not running, the Monitor starts it in a terminal named `<app> · monitor` (a phone app: you pick
   the device). It never starts one twice: a running app is only shown. *Run and watch* starts it again later.
3. **Console**: the lines of the run, newest at the bottom. A request shows its method, path, status (green, amber
   for 4xx, red for 5xx) and time; an error is red, with its cause; open it to read its stack (your code's lines
   stand out), and *Open in the code* goes to the `.nuc` line. *All*, *Requests* and *Errors* filter the lines.
4. **Measurements**: with *Measure the app* on (the Monitor turns it on when it runs the app; in a terminal
   `nuclear monitor --on`, or `nuclear run --monitor`), use the app, then read the **hot spots** first:
   - `slow`: its own time is a fifth or more of the whole call;
   - `async calls in a loop`: an async call made five or more times, one after another, inside one call of its
     parent: start them together (`~awaitAll([...])`);
   - `many connections`: ten or more new connections per call (a client or a pool made per call);
   - `much memory`: 10 MB or more grown per call.
   Under them, each row is a function with its time (the bar; its own time darker), calls, connections and memory.
   Click a name to open its `.nuc` at the line. Measuring stays on through saves and reloads until you turn it off.
5. If the app could not start, the Monitor says where (the build, the packages, the server, the device): fix it and
   *Try again*. *Details* has the folders, the files and the raw reason.

In a terminal, `nuclear monitor` prints the same: the state of the run, the requests and errors, and the
measurements.

Turn measuring off before you ship (`nuclear monitor --off`): the monitor is for finding the problem, not for
production.

What it cannot do yet: measure an app on a phone or in a browser (its console works); show the lines of a phone app
started with `nuclear run` in a terminal (Flutter keeps that terminal: run it from the workspace instead). See the
[roadmap](../01-product/roadmap.md).
