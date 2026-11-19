---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [design.md, tasks.md, ../012-observability/requirements.md]
---
# Spec 015: Nuclear Monitor — Requirements

## Goal

See where an app spends its time without a debugger: each function and method **of the Nuclear code** with its
time, its own time, its calls, the network connections it opens and the memory it grows, as a tree that opens like
an accordion down to the slow call. The same report is read by the editor and by the agents, to find the bottleneck
and propose the fix.

```
AppComponent.build              2345 ms
  ChatComponent.build           2320 ms
    GetUserChat.exec            2200 ms
      UserRepository.getUser    1200 ms   1 connection
      UserRepository.getHistory   86 ms
      convertData                120 ms
      OtherComponent.sendChat   1000 ms   ×12 per call (async in a loop)
```

## Users

- The developer: something is slow or breaks; runs the app with `--monitor`, opens the Monitor in the editor and
  clicks down the tree to the line of the `.nuc` that takes the time.
- The agent (Nuclear Developer, a provider's model over MCP): reads the report, names the bottleneck and proposes
  the change in Nuclear.

## Requirements

1. **Opt-in at build time, nothing when off.** `nuclear build --monitor` and `nuclear run --monitor` write the
   measurement; without the flag the generated code is byte for byte the same (the golden tests prove it).
2. **Not the debugger.** No debug session, no breakpoints, no adapter: the transpiler writes a light wrapper (a clock
   read at entry and exit) and the dialect decides how it is written (root rule 2).
3. **Only Nuclear's code.** Each declared function and method of the project's `.nuc` files; never the target's
   libraries nor the framework's runtime, never lambdas.
4. **What is measured, per node of the call tree** (a node is one function reached by one path of callers):
   calls, total time, own time (total minus its children), the slowest call, whether it is async, the calls per call
   of its parent (an async call repeated inside one parent call is the loop of awaits), network connections opened
   inside it, memory grown during its calls.
5. **Every dialect of the same Nuclear:** `typescript` (and `react`, `nestjs`), `python` (and `fastapi`), `dart`
   (and `flutter`). The `.nuc` never changes to be monitored.
6. **The report is a file:** JSON at `.nuclear/monitor/report.json` of the project, written while the app runs (every
   two seconds when something changed) and at exit. Its format is documented and stable for tools.
7. **The editor shows it:** a Monitor tool in the VS Code extension: the tree as an accordion with a bar per node
   (time), its calls, connections and memory; a click opens the `.nuc` at the line; it refreshes when the report
   changes.
8. **The agents read it:** `nuclear monitor` prints the report as text and as JSON (`--json`), with the hot spots
   first; the MCP server has a tool for it; a run of the report can be stored in the Smart Graph for the agents.
9. **Light** (the golden rule): one node lookup and two clock reads per call; no allocation per call besides the
   span; memory and connections read only from counters the runtime already keeps.

## Out of scope (v1)

- Sampling CPU profiles, flame graphs of the target's frames, the profiler of the target (clinic.js, py-spy,
  DevTools): they already exist.
- The report of an app running on a phone or in a browser tab (no shared file system): phase 2 (`tasks.md`).
