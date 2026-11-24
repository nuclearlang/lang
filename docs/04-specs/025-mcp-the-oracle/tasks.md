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
- [x] T0.3 agent: the baseline, recorded below (2026-11-24). The benchmark's tasks (spec 020) are not built yet, so
      the baseline is one spec on a fresh `nuclear new books -p backend -d fastapi`: *Books: list and create* (a
      title and an author, both `@required`; `GET /books`, `POST /books`), the six stations, no gate, the factory
      isolated (`NUCLEAR_FACTORY_HOME`). The comparison of each phase runs the same project and spec.

### The baseline: OpenCode 2.3.2 · `opencode-go/claude-haiku-5-5`

| Station | Steps | Turns | Tool calls | By hand | Tokens in | Tokens out | Minutes |
|---|---|---|---|---|---|---|---|
| analysis | 3 | 23 | 35 | 17 | 1 290 364 | 21 604 | 3.2 |
| design | 5 | 66 | 124 | 60 | 4 853 585 | 91 046 | 10.9 |
| tests | 2 | 35 | 38 | 8 | 2 676 638 | 27 681 | 4.3 |
| code | 8 | 45 | 66 | 31 | 3 022 397 | 31 972 | 5.8 |
| **total** | **18** | **169** | **263** | **116 (44 %)** | **11 842 984** | **172 303** | **24.2** |

- **70 076 tokens in per turn**, of which ~13 000 are the fixed context: the rest is the history (the tools'
  results and what was read by hand).
- The run stopped at the Code, both times it was run: `@required` on an empty text answers the rule `minLength`
  and the agents tested `required` (the backend platform's roadmap, *To decide with the user*). Quality and
  Delivery are not measured yet.
### The baseline: OpenCode 2.3.2 · `opencode-go/deepseek-v4.1-flash`

Stopped by its 90-minute limit in the Tests (the minutes add up the steps that ran at the same time):

| Station | Steps | Turns | Tool calls | By hand | Repeated | Tokens in | Tokens out | Minutes |
|---|---|---|---|---|---|---|---|---|
| analysis | 3 | 78 | 102 | 47 | 2 | 5 375 466 | 66 682 | 23.1 |
| design | 5 | 399 | 557 | 254 | 14 | 38 484 491 | 297 237 | 84.4 |
| **total** | **8** | **477** | **659** | **301 (46 %)** | **16** | **43 859 957** | **363 919** | **107.5** |

- **91 949 tokens in per turn**; the same two stations took 3.7 times Haiku's turns and 7 times its tokens. A cheap
  model explores more by hand and each turn carries more history: where the oracle should save the most.

- A first run on the same model (a spec that asked for 422) gave 17 steps, 124 turns, 8 625 442 tokens in: the same
  ~70 000 per turn.
- Found on the way and fixed: an agent that marked several checks at once tore `checks.json` and the engine fell
  (`changeChecks`, `writeAtomic`); OpenCode put the user's `~/.claude` instructions into the model's prompt (it
  answered in their style): T1.3.

## Phase 1 — Free wins

- [x] T1.1 agent: `nuclear-mcp --skip <names>`, passed by the factory with the Builder's own tools' names.
      Measured: `nuclear-mcp` gives an agent of the factory 45 tools (~10 200 tokens) instead of 92 (~17 900); both
      servers ~19 900 instead of ~27 700 (−28 %). Left for the profiles (T3.1): the same action under two names
      (`team_edit` / `team_update`, `member_edit` / `team_member_update`, `spec_create` / `spec_new`).
- [x] T1.2 agent: Anthropic's prompt cache in the API adapter (the top-level `cache_control`), the tools in the
      servers' order every turn, a turn priced fresh, read and written as its `usage` splits it. Not run against the
      real API (no key in the vault): tested with the HTTP stubbed.
- [x] T1.3 agent: OpenCode isolated: `OPENCODE_DISABLE_CLAUDE_CODE=1` (no `~/.claude/CLAUDE.md`), and its skills,
      web, images, subagents and questions denied (`OPENCODE_PERMISSION`: denying `skill` also drops the skills of
      `~/.claude/skills`, `~/.agents/skills` and `~/.config/opencode/skills`, which the variables alone do not).
      Measured with a captured request: OpenCode's first request of a step went from ~12 900 to ~8 000 tokens (−38 %;
      with T1.1). Left: whether the other agents (Claude Code, Codex, Gemini CLI) read the user's own files
      (`~/.claude`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`); a read denied by path goes with T2.3.
- [x] T1.4 agent: the context preflight for the local models, the only ones whose window can be smaller than what the
      factory sends (the APIs' and the agents' hold a million or more): `ollamaWindow` before the call, Ollama's 400
      said with its fix, in the adapter both a run and a chat answer go through (`localOpenCodeAdapter`).

### Phase 1 against the baseline (Haiku, T1.1 and T1.3; one run each side, 2026-11-24)

| Analysis to Code | Baseline | Phase 1 | Change |
|---|---|---|---|
| Turns | 169 | 120 | −29 % |
| Tool calls | 263 | 183 | −30 % |
| By hand | 116 | 78 | −33 % |
| Tokens in | 11 842 984 | 7 080 950 | −40 % |
| Tokens in per turn | 70 076 | 59 007 | −16 % |
| Minutes | 24.2 | 12.4 | −49 % |

The Code passed (the baseline stopped there twice) and the run reached the Quality. One run a side: the guard's
comparison holds only with more runs (spec 020's harness).

The same run on to the Quality (the user's approvals of the analysis and the design marked skipped: no gate in a
sandbox): 37 steps, 245 turns, 426 tool calls, 245 by hand, 15 094 070 tokens in (61 608 per turn), 26.6 minutes.
**The Quality alone was 18 steps, 104 turns, 147 reads by hand and 6 705 733 tokens in**: each check by prompt
opens the files it reviews on its own. It ended asking the user (a title's longest length, pages for the list, a
private API) and with two checks of style failed: the work of QA, not of the factory's context.

### Phase 2's first part against phase 1 and the baseline (Haiku; the oracle's note, the documents' paths, the generated folders denied)

This run stopped at the Tests on the same platform question (`""` under `@required`), so the three are compared on
the stations they all ran:

| Analysis to Tests | Baseline | Phase 1 | Phase 2 | Phase 2 against the baseline |
|---|---|---|---|---|
| Turns | 124 | 95 | 91 | −27 % |
| Tool calls | 197 | 138 | 114 | −42 % |
| By hand | 85 | 60 | 34 | −60 % |
| Tokens in | 8 822 587 | 5 641 860 | 4 990 301 | −43 % |
| Minutes | 18.4 | 10.2 | 9.4 | −49 % |

The note took the reads by hand down 43 % from phase 1. One run each: what holds is the direction, not the digit.

Again with `""` under `@required` answering `required` (ADR-synapsis-0014, the user's decision on the question this
baseline raised): analysis to tests in 89 turns, 108 calls, 30 by hand, 5 155 947 tokens in, 10.9 minutes, as the
run before. It passed that question and stopped at the Tests on another: the analysis planned that a body that is
not JSON answers `json`, and a test cannot send one (the backend platform's roadmap, *Pending*). What stops a run
now is what the platform cannot do yet, not the factory's context.

## Phase 2 — The oracle answers more per call

- [ ] T2.1 agent: the project's map in `project_inspect`.
- [ ] T2.2 agent: compact `test` and `check`; `verify`; several files per read.
- [ ] T2.3 agent (half done): `ORACLE_NOTE` in `stationPrompt` and each document with its path; OpenCode denies
      reading and changing `build/`, `node_modules`, `dist` (checked with a local model: a denied read is refused, and
      a weak model asks it again, so the prompt says it first). Left: the comparison run, and the same paths denied
      in the other agents (Claude Code `Read(build/**)`, Codex, Gemini CLI).

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
