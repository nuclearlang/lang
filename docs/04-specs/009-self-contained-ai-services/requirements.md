---
status: approved
owner: Julian Molina
updated: 2026-11-17
related: [../../../installer/docs/03-adr/0003-the-ai-services-bring-their-own-python.md, design.md, tasks.md]
---
# Spec 009: the AI services, ready to run from the installer — Requirements

## Goal

`curl … | sh` (or `irm … | iex`) on a clean machine, of any of the supported systems, leaves the Smart Graph, the
MCP server, the Nuclear Developer and Nuclear Builder ready to run, with nothing assumed on the machine: no Python,
no uv, no Node.js. Asked by the user on 2026-11-17. The decision is ADR-installer-0003.

## Requirements

1. The release builds, for each system and processor, one archive with a Python of its own and the four services
   installed in it, tested by the release's CI on that system before it is published.
2. The installers download that archive only when the user wants the AI services (`--no-ai` skips it), check its
   SHA-256, and unpack it into the installation; `nuclear-graph`, `nuclear-mcp`, `nuclear-developer` and
   `nuclear-builder` are on the PATH after it.
3. Nuclear Builder is a Nuclear project (`python` dialect) in that runtime; the editors run it as a process.
4. Ollama and the models are installed by the user, guided by the extension's welcome page step by step; the
   user chooses each model, sees its size and how it sits on the machine, and downloads it with one button.
5. The services listen on 127.0.0.1 on ports the set-up checked it can listen on; a port held by another program
   or kept by the system is passed over; every service and client finds the chosen port.
6. Without Ollama, the remote mode works (the MCP server with the generators, the compiler, the command line and
   the internet tools).
7. An update keeps the machine's choice; `--uninstall` removes the runtime and leaves the user's data, Ollama and
   the models.

## Out of scope

- Linux with musl (Alpine): no local services (onnxruntime has no wheel for it).
- Installing Ollama or pulling a model without the user pressing its button.
