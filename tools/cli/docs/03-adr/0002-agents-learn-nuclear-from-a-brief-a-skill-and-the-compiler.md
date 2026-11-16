---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0002: Agents learn Nuclear from a short brief, one skill, a project's agent files and the compiler's errors

## Context and problem
No model was trained on NuclearLang, and none is trained or fine-tuned for it. The language saves about four times
the tokens of the equivalent Dart, but explaining it with the full spec cost more than the saving: the Flutter spec
is about 50k tokens, 2.5 times a whole project. An agent also could not see its own mistakes without being told to
run the check.

## Decision
1. **The brief.** A sheet per dialect, written by hand, holding only what changes from TypeScript / Dart / Python,
   kept in the `docs/07-reference/brief/` of the language, of each language dialect and of each platform, checked
   by `spec-check` like the references. `nuclear spec --brief --dialect <d>` concatenates the base and the chain
   (flutter is about 3k tokens; a test keeps it ≤ 16 KB). A dialect outside NuclearLang may bring its own
   `brief.md`.
2. **The skill.** One `SKILL.md` in the open Agent Skills format (`tools/cli/agent-files/skills/nuclear/`),
   installed by the installers in `~/.claude/skills` (Claude Code; Cursor and OpenCode also read it),
   `~/.agents/skills` (Codex, Cursor, OpenCode) and `~/.codex/skills` (older Codex). It does not copy the brief: it
   asks the installed binary for it.
3. **Per project.** `nuclear agent init` (and `nuclear agent init`, also run by `nuclear new`) writes the
   NuclearLang section of `AGENTS.md` (between markers, the rest kept), `CLAUDE.md` with `@AGENTS.md`,
   `.cursor/rules/nuclear.mdc` and a Claude Code `PostToolUse` hook (`nuclear agent hook`) that checks each edited
   `.nuc` with its project and gives the errors back, one line each, with exit code 2.
4. **The evaluation.** `nuclear-synapsis-framework/eval/agent-eval/` (10 tasks: 7 Synapsis on a copy of an app, 2
   TypeScript, 1 Dart) runs `claude -p` headless with the user's account, in the modes `baseline` (no skill) and
   `agent`; the results are `results/<mode>.json`.

## Options considered
1. A brief generated from the specs: less control over what an agent needs first.
2. A copy of the skill in every project: it would go stale; the global skill asks the binary.
3. An MCP server instead of the shell: more fixed tokens, and the CLI already answers through the shell. (An MCP
   server was built later for another purpose, the generators and the local agents: `ADR-platform-0003`,
   `ADR-codegen-0001`.)
4. The hand-written brief, one global skill, the project files and the hook. Chosen.

## Consequences
- Positive: an agent learns Nuclear with about 3k tokens instead of the 50k of the full Flutter spec, and sees its
  errors without asking.
- Negative: running the evaluation spends the user's quota (about USD 5 per mode in API-equivalent cost): ask
  first.
- Measured once: baseline 10 of 10 green, 9.8 turns, about 460k tokens per task; with the skill, `AGENTS.md` and
  the hook 10 of 10, 10.6 turns, about 456k tokens. Agents already learn from the project's own `.nuc` files, so
  these tasks do not separate the modes: harder tasks are needed (a project from scratch, nothing to copy;
  [the plan](../04-specs/001-agent-support/plan.md), F7).

## References
- Replaces: ADR-0087
- The plan it delivered: [04-specs/001-agent-support](../04-specs/001-agent-support/plan.md).
- The diagnostics that teach (habits of other languages, validation against the type definitions): `ADR-lang-0010`.
