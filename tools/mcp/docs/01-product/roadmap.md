---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [tools/mcp/docs/08-guides/mcp.md]
---
# Roadmap of the MCP server

The pending work of the server. A done item is deleted.

## Half done

- **`web_search` needs SearXNG or a Brave key to be useful**: without either it asks Wikipedia, which answers noise.

## Untested

- The server from an interactive Claude Code, Codex or Cursor (only a Python client and `claude -p` with Sonnet;
  not with Opus or Haiku): `graph_strategy`, `graph_card`, `graph_answer`, `developer_code(project)`,
  `developer_retry(from_step, scratch)`, `generate_usecase` and the other generators.

## Pending

- **`nuclear_start` measured with a real client** (spec 016, phase 5): a fresh agent in a clean machine, the release
  installed, no source tree.
