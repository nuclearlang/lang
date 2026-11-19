---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../06-runbooks/update-the-knowledge-base.md, ../02-architecture/exact-facts.md, ../02-architecture/search.md]
---
# Testing

Three things are tested: the code, the knowledge base, and what the graph answers.

## The code

```sh
nuclear check . && nuclear build .          # the .nuc files → build/nuclear_graph
uv sync --extra server --extra test
.venv/bin/python -m pytest -q
```

The tests are written in Nuclear (`tests/*.nuc`) and built with the package (`build/nuclear_graph/tests`; the wheel
leaves them out). Build before testing.

| File | Covers |
|---|---|
| `tests/test_secrets.nuc` | a secret of a closed keyring is refused and never made again |
| `tests/test_graph.nuc` | nothing without a token and no browsers; access only when the user allows it; encryption at rest; an agent writes only `memory` and `examples`; the search by exact name, by id and by question; what a local agent reads; the strategy of a request and the limits of a spec |
| `tests/test_facts.nuc` | the exact facts (every name and field, never a body), a broken query of the catalogue, the planner, the catalogue of this tree |
| `tests/test_knowledge.nuc` | rows read from their sources, a base valid or not versioned, the revision and the review, overlays, an ingest (only what changed, what agents wrote kept, the facts filled), a help text as one row per command |
| `tests/test_agents.nuc` | the tools for agents: paths by the layout, the compiler's output, `Workspace` (an agent reads only the project, the context of a task, a rename), the MCP server's tools with and without the local ones, a spec's markdown, an API's answer as a shape |
| `tests/support.nuc` | what the tests share |

`tests/test_agents.nuc` also holds every tool of the MCP server to the documentation: each tool's name must be
written in the two documents it reads. The package is type-checked with pyright (`typeCheckingMode = "standard"`,
over `build`).

The tests need the whole working tree: they read the tree's files and the knowledge base.

## The knowledge base

| Command | Fails when |
|---|---|
| `nuclear-graph knowledge build` | a row is invalid ([what the build refuses](../02-architecture/knowledge-base.md#valid-or-not-built)) |
| `nuclear-graph knowledge check` | the base is behind the tree, or the running graph holds another revision |
| `nuclear-graph knowledge examples` | a ```` ```nuclear ```` block of a hand-written row does not compile |

`knowledge examples` compiles each block alone (`nuclear check --platform`), for its row's first platform
(`backend` when it names none); a block that is a project's manifest (`config.nuc`) is not checked alone.

## What the graph answers

`nuclear-graph knowledge ask [word...]` asks the running graph every entry of `data/questions.toml` (or the ones
that contain one of the words) and fails when one does not get what it expects:

| Entry | What is asked | It passes when |
|---|---|---|
| a question | `POST /v1/search` (with its `shelves`, `kind`, `platform`, `agents`) | a row of `expect` is among the first `top` results (3 by default) |
| `exact = true` | `POST /v1/answer` | the planner's first query is the expected one |
| `exact = false` | both | it finds its card, and the planner runs no query: an open question that reads like an exact one ("what is nuclear", "how does the mcp work") |
| `request = true` | `POST /v1/strategy` (with `existing`, `new`) | the first strategy is the expected one |

- `expect` may end in `*`: any row whose id starts with it.
- The questions and requests are in English and Spanish. A request is never one of the `asks` of its row.
- The entries with `says` are also asked to the assistant of the Nuclear Developer (`eval/run.py chat`).
- A question a change answers is added with the change; a new exact question is a row of the catalogue with its
  `exact = true` entry.

Measured: the 62 requests all reach their strategy. Of the open questions, the planner runs a query only for the
ones that name one thing ([the roadmap](../01-product/roadmap.md) has what is left).

## The prompts

The prompts are the skills of the roles (`nuclear-agents/roles/<role>/skills/*.md` that name a `prompt`); the test
`testThePromptsAreTheRolesSkillsWithoutTheirFrontMatter` holds what `ingest` reads from them. They are measured by
the evaluation of the Nuclear Developer: a change to one is a new round, recorded in its report
([how](../../../nuclear-agents/nuclear_developer/docs/06-runbooks/evaluation.md)).

The MCP test (`tests/test_agents.nuc`) holds every MCP tool to the MCP server's guide,
`tools/mcp/docs/08-guides/mcp.md`: a new tool is documented there.
