---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../../README.md]
---
# Nuclear Monitor

1. Run your app with the monitor: `nuclear run --monitor` (a backend), or `nuclear build --monitor` and run it your
   usual way (a program of Node.js, Python or Dart). Use it: open the screens, call the routes that are slow.
2. In VS Code run *Nuclear: Open Monitor* (with a `.nuc` of the project open). In a terminal: `nuclear monitor`.
3. Read the **hot spots** first:
   - `slow`: its own time is a fifth or more of the whole call;
   - `async calls in a loop`: an async call made five or more times, one after another, inside one call of its
     parent: start them together (`~awaitAll([...])`);
   - `many connections`: ten or more new connections per call (a client or a pool made per call);
   - `much memory`: 10 MB or more grown per call.
4. Open the tree under a hot spot: each row is a function with its time (the bar; its own time darker), calls,
   connections and memory. Click a name to open its `.nuc` at the line.

A save in the editor builds the project again without the monitor: measure, then edit.

Build again without `--monitor` before you ship: the monitor is for finding the problem, not for production.

What it cannot do yet: a phone or a browser tab cannot write the report to your project's folder (the
[roadmap](../01-product/roadmap.md)).
