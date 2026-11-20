---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../../AGENTS.md, ../../../../../docs/04-specs/015-monitor/design.md]
---
# How the report reaches the page

```
nuclear run --monitor ──► the build: each function's body in the dialect's monitor_body, nuclear/monitor written
        │                 (NUCLEAR_MONITOR_FILE = <project>/.nuclear/monitor/report.json, inherited by the app)
        ▼
the app runs ──► NuclearMonitor writes the report every 2 s while something changed, and at exit
        ▼
FileSystemWatcher **/.nuclear/monitor/report.json ──► MonitorPanel.refresh ──► nuclear monitor --json ──► page()
```

- `readMonitor` runs `nuclear monitor --json --project <folder>` from the active `.nuc`'s folder (or the first
  folder of the workspace); the command finds the report there or above. Without a report the page shows the
  command's message and how to get one.
- The tree: one `<details>` per node, open for the first two levels and for every flagged node; the bar's length is
  the node's time against the longest root, its darker part the own time. Concurrent children can add up past
  their parent (their own time is then zero).
- A click on a name posts `{ type: 'open', path, line }`; the panel opens `<project>/<path>` at the line (the
  project is the folder above `.nuclear/`).
- Redraws are debounced (300 ms): the app writes at most every two seconds.
- The page carries the floating update button of every NuclearLang page (`withUpdateButton`,
  `extensions/vscode/src/updateCheck.ts`).
