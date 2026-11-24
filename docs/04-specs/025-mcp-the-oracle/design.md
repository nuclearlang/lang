---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-24
related: [requirements.md, tasks.md]
---
# Spec 025: The MCP server is the oracle — Design

The rule of the design: **what an agent uses always is in its first request; what it uses rarely is one search away;
what it reads by hand today is one call of the oracle.** On-demand loading costs a turn, and a turn costs more than
the tokens it saves (a local model reprocesses the whole prompt each turn), so the oracle is made to answer more per
call, not to be asked more often.

## The pieces, by project

| Project | Change | Requirements |
|---|---|---|
| `tools/mcp` (`nuclear-mcp`) | `--for <station>`: the station's profile; `--no-factory`: leaves out the Builder's tools; `nuclear_tools` (find a tool by words, get its schema, call it); the project's map in `project_inspect`; `test`/`check` compact; `verify`; several files per read; short descriptions | 5-11, 15 |
| `extensions/tools/nuclear-builder` | the adapters start the servers with the station's profile; the ledger's new fields and `metrics`; the station prompt; reads of `build/`, `node_modules`, `dist` denied; OpenCode isolated from the user's agent files and unused built-in tools; Anthropic's prompt cache; the context preflight | 3-4, 6, 12-14, 18-19 |
| `tools/cli` | the NuclearLang section of `AGENTS.md` (`agent-files/project/AGENTS.md`) says the oracle's rule; `nuclear agent init` refreshes old projects | 15, 17 |
| `tools/code_generator` | the context documents: `docs/README.md` holds the oracle's rule; `02-architecture/overview.md` keeps the project's architecture (layers, layout, C4, flows) | 15-16 |
| `nuclear-graph-storage` | the rows of the new tools and options; the knowledge base's guide for agents says the same rule | 15 |

## The profiles

A profile is data, not code: `tools/mcp` holds one list per station (`analysis`, `design`, `tests`, `code`,
`quality`, `delivery`) and one for the chat, made from the ledger's counts and reviewed at each round of the
benchmark. The core tools (`nuclear_start`, `nuclear_doc`, `nuclear_help`, `graph_search`, `nuclear_project`,
`project_inspect`, `nuclear_tools`) are in every profile. `--informs` (Atlas) stays as it is: a profile of its own.

## The catalog without repeats

The 47 tools both servers offer stay in both: an agent outside the factory (Claude Code on a project) has only
`nuclear-mcp`, and every action of the Builder is a tool of `nuclear-builder mcp` (ADR-platform-0009). The factory
passes `--no-factory` to `nuclear-mcp` when it starts both.

## The project's map

`project_inspect` answers, with no model call: the platform and dialect, the components with their layers and `.nuc`
files, the layout of the platform (where each kind goes), the spec at work and its documents' names. It is the first
call of a station; the station prompt says so.

## Compact results

`test` and `check` answer `{passed, failed, errors: [{file, line, message, fix}], log}`; the whole output goes to a
file under `.nuclear/` whose path is in `log`. `verify` runs `check`, `fmt --check` and `test` and answers the three
in one result.

## The agents' context

- OpenCode: the run's configuration turns off its reading of the user's agent files and the built-in tools the
  factory does not use (image generation, web search, subagents). How OpenCode 2.3 turns off the reading of
  `~/.claude` and whether its permissions deny a read by path is verified first (task T1.3); where it cannot, the
  limit goes to the Builder's roadmap.
- Claude Code: `--strict-mcp-config` already; reads denied by path (`Read(build/**)`).
- The API adapter: the profile's tools only, a stable order, `cache_control` on the tools, the system and the last
  message.

## The project's documents

The NuclearLang section of `AGENTS.md` gains, after its first line:

> The `nuclear` MCP server is your oracle: ask it before you open a file. What Nuclear is, its syntax, kinds, words,
> commands and how-tos, the platform, the factory's specs, runs and teams, and this project's map are answered there
> (`nuclear_start`, `nuclear_doc`, `project_inspect`). This project's `docs/` hold only what is its own: its
> architecture (its components' layers, presentation, domain and data, and where each piece goes), its business,
> its decisions and its conventions.

`docs/README.md` of the context documents says the same rule for whoever writes the documents: never copy into the
project what the oracle answers; always write there the project's architecture.

## The context preflight

The window comes from the provider: Ollama's `/api/show` and its running `num_ctx` (`/api/ps`), the Models API's
`max_input_tokens` for Anthropic, a table for the others. The fixed context is measured the same way as phase 0 does.
The refusal is an error of the run or the answer with the window, the need and the fix.

## Tests

| Requirement | Test |
|---|---|
| 1-2 | the benchmark's baseline and each phase's comparison, recorded in `tasks.md` |
| 3-4 | `test_metrics.nuc`: a fixture ledger with the new fields |
| 5-7 | `tools/mcp` tests: no tool twice with `--no-factory`; each profile has the core; `nuclear_tools` finds and calls; every description's first sentence under a length |
| 8-11 | `tools/mcp` tests on a fixture project: the map, the compact results, `verify`, several files |
| 12-14 | the adapters' tests: the prompt, the denied paths, OpenCode's configuration (no user files, no unused tools) |
| 15-17 | `tools/cli` and `tools/code_generator` tests: the section and `docs/README.md` say the rule; `agent init` merges into an old project (fixture) |
| 18 | `api_anthropic` test: the request carries `cache_control` and the same tools' order twice |
| 19-20 | a preflight test with a stubbed Ollama; a real step on gemma4 with a 32k window |
