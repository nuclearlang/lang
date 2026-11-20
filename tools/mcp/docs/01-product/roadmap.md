---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [tools/mcp/docs/08-guides/mcp.md]
---
# Roadmap of the MCP server

The pending work of the server. A done item is deleted.

## Half done

- **`web_search` needs SearXNG or a Brave key to be useful**: without either it asks Wikipedia, which answers noise.

## Untested

- The server from an interactive Claude Code, Codex or Cursor (only a Python client and `claude -p` with Sonnet;
  not with Opus or Haiku): `graph_strategy`, `graph_card`, `graph_answer`, `generate_usecase` and the other generators.

## Pending

- **The local models on standby** ([ADR-platform-0013](../../../../docs/03-adr/0013-local-models-on-standby.md)): no
  `developer_*` tool is registered (`LOCAL_MODELS = false`). Turning them on again needs `LOCAL_MODELS = true` with
  `localModels: true` in Nuclear Builder's `setup.json`, the Developer installed by the set-up again, and tests of the
  `developer_*` tools and of the local work cycle (`LOCAL`) against a running Developer.

- **`nuclear_start` measured with a real client** (spec 016, phase 5): a fresh agent in a clean machine, the release
  installed, no source tree.
