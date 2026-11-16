---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [docs/04-specs/008-restructure/tasks.md, tools/mcp/docs/08-guides/mcp.md]
---
# Roadmap of the MCP server

The pending work of the server. A done item is deleted.

## Half done

- **The project out of the graph** (spec 008, T4.3): `mcp_server.nuc` and what it needs of `toolchain.nuc` and
  `web.nuc` move from `nuclear-graph-storage/` to `tools/mcp/`
  ([tasks](../../../../docs/04-specs/008-restructure/tasks.md)).
- **`web_search` needs SearXNG or a Brave key to be useful**: without either it asks Wikipedia, which answers noise.

## Untested

- The server from an interactive Claude Code, Codex or Cursor (only a Python client and `claude -p` with Sonnet;
  not with Opus or Haiku): `graph_strategy`, `graph_card`, `graph_answer`, `developer_code(project)`,
  `developer_retry(from_step, scratch)`, `generate_usecase` and the other generators.
- The OpenCode MCP entry: its config format was not run against OpenCode.

## Pending

- **Every project created with Nuclear gets the documentation of the MCP server and of everything Nuclear can do**
  (the user's rule). What `nuclear agent init` / `dragonfly agent init` write today
  (`tools/cli/agent-files/project/`) names the `nuclear` and `dragonfly` commands and not the server or its tools;
  only the `nuclear` skill of the machine names it, in one line (`graph_strategy` first).
  TODO(human): what should a project get: a section of its `AGENTS.md`, the client's MCP entry (`.mcp.json`,
  `.cursor/mcp.json`), a copy of the guide, or all of them?
