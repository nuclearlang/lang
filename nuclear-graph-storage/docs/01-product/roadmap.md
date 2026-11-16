---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/exact-facts.md, ../02-architecture/knowledge-base.md, ../05-standards/testing.md]
---
# Roadmap

The pending work of the Smart Graph. A done item is deleted. What is pending of the agents that read the graph is
in [the Nuclear Developer's roadmap](../../../nuclear-agents/nuclear_developer/docs/01-product/roadmap.md); of the
MCP server, in the project [`tools/mcp`](../../../tools/mcp/AGENTS.md).

## Half done

- **The knowledge base still describes the tree of before the restructure.** It is rebuilt, checked and ingested
  once the sources that read the tree (the extractors, `data/sections.toml`, the tests, the Python environment)
  and the documents follow the new folders. Tracked in the platform's spec 008
  (`docs/04-specs/008-restructure/tasks.md`, T1.5 and T3.5).

## Pending

- **The rows of `query:kind.create` name a generator's condition with the generator's own word** (`when rest`,
  `when db`), not with the option that sets it (`--source rest`): the generated rows of the generators need the
  option of each condition.
- **The planner and the open questions** (measured 2026-11-13). It runs a query for 12 of the 111 open questions,
  each about one named thing (a diagnostic's code, where a kind's file goes, the example files of a kind). One gets
  more than it asks: the bare command "dragonfly gen usecase" also gets the 9 rows of `query:generators` (its
  question is within `BESIDE` of `query:cli.command`'s).
- **`query:examples` has no row for a repository or an entity of the backend**: no example project on the shelf
  declares one (`rick_api` reads an API).
