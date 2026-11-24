---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-24
related: [design.md, tasks.md, ../016-agent-onboarding/requirements.md, ../020-benchmark/requirements.md, ../011-software-factory/requirements.md]
---
# Spec 025: The MCP server is the oracle — Requirements

**Priority: high** (the user, 2026-11-24). An agent learns everything it needs from the MCP server, on demand, in the
fewest turns and tokens: the server is the oracle of information. The agent no longer explores files to find what a
call answers, and the context it starts with is small enough for a local model. A project's documents keep only what
is the project's own, its architecture first, and send the agent to the oracle for the rest.

## Why: what was measured (2026-11-24)

13 runs of the factory (266 steps, 14 064 tool calls), the factory's ledger of 2026-11, both MCP servers listed live,
and one OpenCode 2.3.2 request captured whole.

| Fact | Measure |
|---|---|
| A step's turns | median 47, p90 100 |
| The fixed context of a turn, OpenCode (role 3 200, Code Mode 2 950, `~/.claude` skills and `CLAUDE.md` 3 150, built-in tools 3 600) | ~13 000 tokens |
| The fixed context of a turn, the API adapter (both servers' tools whole) | ~31 000 tokens |
| Tools offered / distinct / repeated in both servers / ever used | 150 / 103 / 47 / 37 |
| Tools' descriptions in the tools' size | 44 % |
| Files read by hand vs questions asked of the server | ~8 300 vs ~1 000 |
| Reads of `specs/` (already in the step's prompt) | 1 299 |
| Reads of `build/`, `node_modules`, `dist` (generated or foreign code) | 724 |
| The same file read again in the same step | 654 |
| Folder reads and globs to find one's way | 1 441 |
| Input tokens of a step (ledger) | 0.4 M (Sonnet) to 2.8 M (DeepSeek) |
| Input tokens of one chat answer (ledger) | 63 000 to 219 000 |
| The API adapter's prompt caching | none |
| Ollama's window for gemma4:26b on a 14.5 GiB GPU | 4 096 (its VRAM default): the factory's first request does not fit |

A step costs `fixed × turns + history`. The largest saving is fewer turns; each turn saved is ~30 000 tokens and
3 s (cloud) to 45 s (local).

## The performance guard
1. WHEN a change of this spec is proposed THE SYSTEM SHALL be measured against the baseline of phase 0 (the
   benchmark's tasks, spec 020) for success, turns, input tokens, cost and time, per provider.
2. IF a change lowers the success rate or raises the time of a step THEN it SHALL NOT be merged; each change is
   reverted on its own.

## The measure
3. WHEN a step or a chat answer ends THE SYSTEM SHALL record in the ledger its turns, its fixed prompt's size, the
   characters of its tools' results, its reads by hand and its repeated reads.
4. WHEN `metrics` is asked THE SYSTEM SHALL report them by station, provider and model.

## A small catalog
5. WHEN the factory starts both MCP servers THE SYSTEM SHALL offer each tool once: `nuclear-mcp` leaves out the tools
   the Builder's server owns. No tool is removed from either server.
6. WHEN a station's agent starts THE SYSTEM SHALL offer the tools that station uses (its profile, from the ledger)
   and one tool that finds and calls any other: an agent always reaches every tool.
7. Every tool's description SHALL say in its first sentence what it answers and when to call it; the rest is a topic
   of `nuclear_doc`.

## The oracle answers what is read by hand
8. WHEN an agent asks for the project's map THE SYSTEM SHALL answer in one call: its components, their layers and
   `.nuc` files, the platform's layout, the spec at work, with no model call.
9. WHEN `test` or `check` runs for an agent THE SYSTEM SHALL answer the totals and only what failed, each with its
   file, line and fix, and the path of the whole log.
10. WHEN an agent verifies a change THE SYSTEM SHALL check, format-check and test in one call.
11. WHEN an agent needs several files THE SYSTEM SHALL give them in one call.

## The agents use the oracle
12. A station's prompt SHALL say that the documents of the stations before are in it and the project's map is one
    call away, and that the oracle is asked before any file is opened by hand.
13. IF an agent tries to read `build/`, `node_modules` or `dist` THEN THE SYSTEM SHALL refuse it and name the tool
    that answers instead (generated code is never the agent's: root rule 13).
14. WHEN the factory renders an agent THE SYSTEM SHALL give it only the installation's and the project's context:
    never the user's own agent files (`~/.claude/skills`, `~/.claude/CLAUDE.md`, an editor's rules), nor built-in
    tools the factory does not use (root rule 14).

## The project's documents point to the oracle
15. The context documents `nuclear new` writes, and the NuclearLang section of `AGENTS.md`, SHALL say that the MCP
    server is the oracle: what Nuclear is, its syntax, kinds, words, commands, how-tos, the platform's meaning, the
    factory's state (specs, runs, teams) and the project's map are asked of it, never copied into the project's
    documents nor read from the installation's files or `build/`.
16. The project's documents SHALL keep what is the project's own: **its architecture** (the layers of its components
    as the platform lays them out, presentation, domain and data; where each piece goes; its C4 context and
    containers; its critical flows), its business and domain, its product, its decisions and its conventions.
17. WHEN `nuclear agent init` runs in a project made before this spec THE SYSTEM SHALL refresh the NuclearLang
    section and add the oracle's rule to `docs/README.md` without overwriting what the user wrote.

## Cost and local models
18. WHEN the API adapter calls Anthropic THE SYSTEM SHALL cache the tools, the system prompt and the conversation
    so far; the tools' order SHALL be stable so OpenAI's and Google's automatic caches hit too.
19. WHEN a run or a chat answer starts THE SYSTEM SHALL compare the model's context window with the fixed context it
    is about to send and, when it does not fit, refuse before the call, saying the window, the need and the fix
    (for Ollama, `OLLAMA_CONTEXT_LENGTH`).
20. WHEN phases 1 to 3 are done THE SYSTEM SHALL start a factory step on a local model with a 32 768-token window.

## Out of scope
- Changing the MCP protocol or a client's way of loading tools (OpenCode's Code Mode, Claude Code's deferred tools).
- The roles' skills as an index loaded on demand: measured in phase 3, adopted only if the guard holds.
