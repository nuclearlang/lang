---
status: approved
owner: Julian Molina
updated: 2026-11-17
related: [requirements.md, tasks.md]
---
# Spec 009 — Design

## The archive

`nuclearlang-ai-<version>-<os>-<arch>.tar.gz` (`.zip` on Windows), with its `.sha256`, unpacked at
`<installation>/ai/`:

```
ai/python/                    python-build-standalone 3.12, install_only (relocatable)
ai/python/lib/.../site-packages   the locked packages of the graph [server], the MCP server, the Developer, the Builder
ai/nuclear-graph-storage/data/    the knowledge base (ingested by the set-up)
ai/bin/nuclear-graph, nuclear-mcp, nuclear-developer, nuclear-builder   launchers: `exec ai/python/bin/python -m ...`
```

Built by a job of `release.yml` per target: `nuclear build` of the four projects, then
`ai/python/bin/python -m pip install --no-deps -r <the exported lock>` and the four wheels, then a smoke test on
that runner (each launcher answers `--version`; the graph serves `/v1/health`; the MCP lists its tools). The lock
is exported from each project's `uv.lock`, so the runtime has the versions the tests ran with.

Targets: `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `aarch64-apple-darwin`, `x86_64-apple-darwin`,
`x86_64-pc-windows-msvc`.

## The set-up

`nuclear-builder setup` (Nuclear, run by `ai/python`) keeps the steps of ADR-installer-0002 without what the
archive now brings:

1. this machine and the profile (data: `aiSetup.json`, moved beside the Builder);
2. the ports (`servicePorts`: listen on each for a moment, take the next free one, write `ai.env`);
3. the services at login, started now;
4. the knowledge base (`connect`, `ingest`);
5. Ollama and the models: only checked; what is missing is shown in the welcome page, never installed.

## The editors and the set-up

Decided by the user on 2026-11-17: the least memory and the fewest problems of compatibility. The editors run
`nuclear-builder setup` as a process, one call per action; no process of it stays alive between actions (a Python
that waited would hold 60 to 100 MB for nothing, and starting a process is the same on the three systems).

- `--plan --json`: this machine, the profiles with how each sits on it, the suggested one, the machine's choice,
  the AI root, the requirements of both modes.
- `--events --profile <id> --from <step>`: one JSON line per event (`steps`, `step`, `done`, `failed`).
- `--status --json`, `--restart graph|developer`, `--set KEY=value ...`.

What an editor only reads (`ai.env`, the ports in it) it reads itself. Until the engine is in Nuclear, the
command's pipeline subcommands run the installation's `bin/nuclear-builder.js` with node.

## The welcome page

The extension's set-up page becomes its welcome page:

1. what the AI services are;
2. the profile;
3. Ollama: its page for this system, a check every three seconds that sees it running;
4. the models: one row each, with its size, `fit`, and a Download button (`/api/pull` with its progress);
5. the services' state.

## Ports

Done in this spec's first change (2026-11-17), in the TypeScript set-up:
- `canListen`, `choosePort` and `servicePorts` in `aiSetup.ts`, run by the step that starts the graph;
- the graph's `paths.nuc` and the MCP server's `server.nuc` read the port from the environment, then `ai.env`, then
  the default;
- the editor's `urls()` and `aiSettings()` do the same.
