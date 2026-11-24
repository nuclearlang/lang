---
status: in-progress
priority: high
owner: Julian Molina
updated: 2026-11-24
related: [requirements.md, design.md]
---
# Spec 025: The MCP server is the oracle — Tasks

Who: **agent** (in the tree), **user** (money, decisions). Each phase ends with the guard: the benchmark compared with
the baseline, every test set of the tree (`nuclearlang/docs/05-standards/testing.md`), the deploy (root rule 15).

## Phase 0 — The measure (the gate)

- [x] T0.1 agent: the ledger's new fields (turns, fixed prompt's size, tools' results' characters, reads by hand,
      repeated reads) and `metrics` by station, provider and model.
- [x] T0.2 user: the budget and the models of the baseline: 5 USD of API at most, used well; the tests on OpenCode's
      subscription (10 USD a month) with its cheapest models (the user, 2026-11-24).
- [ ] T0.3 agent: the baseline: the benchmark's tasks on each model, recorded here.

## Phase 1 — Free wins

- [ ] T1.1 agent: `nuclear-mcp --no-factory`, passed by the factory when it starts both servers.
- [ ] T1.2 agent: Anthropic's prompt cache in the API adapter; the tools' order stable.
- [ ] T1.3 agent: OpenCode isolated (no user agent files, no unused built-in tools); first verify how OpenCode 2.3
      does it, and whether it denies a read by path.
- [ ] T1.4 agent: the context preflight (Ollama, Anthropic, a table for the others).

## Phase 2 — The oracle answers more per call

- [ ] T2.1 agent: the project's map in `project_inspect`.
- [ ] T2.2 agent: compact `test` and `check`; `verify`; several files per read.
- [ ] T2.3 agent: the station prompt (the documents are in it, the map is one call away, the oracle first) and the
      denied paths (`build/`, `node_modules`, `dist`).

## Phase 3 — A small catalog

- [ ] T3.1 agent: the profiles per station and the chat, from the ledger; `nuclear-mcp --for <station>`;
      `nuclear_tools`.
- [ ] T3.2 agent: short descriptions (first sentence: what and when), the rest in `nuclear_doc` topics.
- [ ] T3.3 agent: the roles' skills as an index: measured, adopted only if the guard holds.

## Phase 4 — The documents and the local models

- [ ] T4.1 agent: the oracle's rule in the NuclearLang section of `AGENTS.md` and in the context documents'
      `docs/README.md`; the architecture kept in `02-architecture/overview.md`; `nuclear agent init` for old projects.
- [ ] T4.2 agent: the knowledge base's rows and its guide for agents.
- [ ] T4.3 agent: a factory step on gemma4:26b with a 32 768-token window, measured.
