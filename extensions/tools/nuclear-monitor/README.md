# Nuclear Monitor

[![extension-vscode](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-vscode.yml)

Where your app spends its time, without a debugger: each function and method of your Nuclear code with its time,
own time, calls, connections and memory, as a tree that opens like an accordion down to the slow line.

## Why

- A debugger stops the app; a profiler of the target shows the generated code and its libraries. The monitor shows
  only your `.nuc`, at full speed.
- It marks what to fix: a slow call, async calls one after another in a loop, many connections, much memory.
- The same report is read by the agents (`nuclear monitor --json`, the MCP tools `project_monitor` and
  `graph_monitor`), so they can propose the fix.

## Try it

```sh
nuclear run --monitor     # use the app a little
nuclear monitor           # the hot spots and the tree in the terminal
```

In VS Code: *Nuclear: Open Monitor*. It redraws while the app runs.

## Read next

- [The guide](docs/08-guides/README.md) · [How it works](docs/02-architecture/overview.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
