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

## Pending

- **Found measuring an OpenCode agent (2026-11-25):** `graph_search` with `k: 8` answers 9-13 k chars and
  `graph_answer` 16.7 k for one question: every hit is its whole card. An agent pays them again on every later turn
  (~1.8 M tokens in one run); a hit should be its id, title and summary, the card read with `graph_card` when chosen.

- **Found at the 0.90.0 release (2026-11-21), not caused by it:** `nuclear-graph knowledge examples` reports 4 errors
  in one block, `concept:workspace` #1: a `workspace.nuc` manifest (`workspace(...)`, `app(...)`) compiled as a
  backend file is N0106; the block should be checked as a manifest, or not be a `nuclear` block. And
  `nuclear-graph knowledge ask` finds 198 of 199 rows: "a test reads an empty database" gets
  `pitfall:test-reads-an-empty-database` fourth, after `strategy:bug-interface`, `error:N0301` and
  `kind:web.repository`.

- **`knowledge review <id>` run once per row forgets the rows reviewed before** (found 2026-11-21): reviewing eight
  rows one call each left seven asking again; `knowledge review` with no ids (or all the ids in one call) keeps them.
  Wanted: a review adds to the reviewed rows.
- **The rows of `query:kind.create` name a generator's condition with the generator's own word** (`when rest`,
  `when db`), not with the option that sets it (`--source rest`): the generated rows of the generators need the
  option of each condition.
- **The planner and the open questions** (measured 2026-11-13). It runs a query for 12 of the 111 open questions,
  each about one named thing (a diagnostic's code, where a kind's file goes, the example files of a kind). One gets
  more than it asks: the bare command "nuclear gen usecase" also gets the 9 rows of `query:generators` (its
  question is within `BESIDE` of `query:cli.command`'s).
- **`query:examples` has no row for a repository or an entity of the backend**: no example project on the shelf
  declares one (`rick_api` reads an API).
