---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0001: The MCP server is a Nuclear project of its own, `nuclear-mcp`

## Context and problem
The MCP server was a module of the Smart Graph's package (`mcp_server.nuc`, started with `nuclear-graph mcp`), so the
graph's package carried the `mcp` library and a machine of remote agents only installed the graph's package to get
it (ADR-installer-0002). The user ordered every project into its own folder with its code (`tools/mcp`).

## Decision
1. The server is the Nuclear project `tools/mcp` (`python` dialect), command `nuclear-mcp`: no argument serves MCP on
   stdio; `nuclear-mcp tools` prints its instructions and tools as JSON.
2. It reaches the graph through the graph's package as a dependency (its type definitions in `defs/`), never the
   other way: the graph's knowledge base reads the server's tools by running `nuclear-mcp tools`.
3. The graph's package has no MCP server and no `mcp` extra. `nuclear-graph mcp` runs `nuclear-mcp`, so a client
   registered before keeps working.
4. A machine of remote agents only installs `tools/mcp` (it pulls the graph's package without its `server` extra:
   33 MB, as before); a machine with the local agents installs the graph's `server` extra and `tools/mcp`.
5. Every client is registered with `nuclear-mcp` and no argument (the editor's setting `nuclear.ai.mcpCommand`).

## Options considered
1. Keep it inside the graph's package: the MCP server's code and dependencies in a project that is not the server.
2. A project of its own that the graph's package depends on: the graph would import its own client back (a cycle).
3. A project of its own that depends on the graph's package.

## Consequences
- Positive: the server's code, tests and dependencies are in its project; the graph's package is lighter.
- Negative: two packages to install where there was one; the old registrations name `nuclear-graph mcp` until the
  set-up runs again.

## References
- Replaces, in ADR-installer-0002, the point "the MCP server is the graph's `mcp` extra".
