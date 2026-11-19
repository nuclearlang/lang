---
status: accepted
date: 2026-11-17
deciders: Julian Molina
---
# ADR-0005: The software factory: stations, roles as files, providers as assignments, teams

## Context and problem
Nuclear Builder ran a spec through nine stages, each with an agent written into the engine: what the planner, the
tester or the security reviewer is lived in prompts of the Smart Graph and in TypeScript, and only the local agents
(ADR-platform-0003) could do the work, with Claude Code as their lead. The user wants every spec to go through the
same stations, each one owned by a role that any agent can play (the local agents, a provider's agent such as
Claude Code, Codex, Gemini CLI or OpenCode, or a provider's model through an API), with everything a role does
written down and the plans the user's to approve (spec 011).

## Decision
1. **Six stations, five roles.** Analysis (Analyst), Design (Architect), Tests first and Code (Developer), Quality
   (QA) and Delivery (Delivery). Each station writes its documents in the spec's folder (`specs/<id>/`) from its
   role's templates, so a run can be read without the tool. The QA role owns the functional and non-functional
   checks, the edge cases, security, good practices, load and performance, and plans before it runs anything.
   Delivery owns the definition of done and the pull request, and never merges: the merge is the user's.
2. **A role is a folder of files**: `nuclear-agents/roles/<role>/` (`role.md`, `skills/`, `templates/`,
   `checks.toml`, the roster). It is the one source of the role: the local agents and every provider read the same
   files, rendered in each one's own format; nothing of a role is repeated in code (ADR-developer-0002).
3. **Who does a role is an assignment, not a model.** For each role the user picks the kind (`local`, `agent`,
   `api`), the provider and the model; three presets fill it (*Local only*, *Claude leads, the local agents
   write*, *Providers only*). A provider's agent brings its own loop and login; a provider's model through an API
   runs in the factory's loop with a key from the system's keyring, never from a file.
4. **Teams.** The user hires an employee for each role from a satirical roster (40 per role), sets who does the
   work, the skills switched on and their own instructions, and keeps several teams, outside the editor's storage,
   written atomically with the previous version kept. A role's files are never changed by a team.
5. **Money is the user's.** One budget per run for every provider together (5 USD by default), confirmed twice
   before the first paid call; a project can force the confirmation.
6. **Nuclear first.** The factory's engine is written in Nuclear (`extensions/tools/nuclear-builder`, `python`
   dialect); the editors only draw its run file and send the user's choices.

This amends ADR-platform-0003: the local agents stay the default and keep their rules (at most 3B parameters, only
Nuclear, measured by the evaluation); a frontier model is no longer only their lead, but one more way to do a role.
Their prompts are the roles' files, which the Smart Graph serves as its `prompts` collection.

*Amended 2026-11-18:* the Delivery role is **DevOps** — the infrastructure and everything Delivery owned (the definition
of done, the documents, the pull request); the station keeps its name (spec 011).

## Options considered
1. Keep the nine stages and add providers inside the engine: every provider would repeat the roles in its own code.
2. One prompt per stage, chosen by model: the user could not mix agents with their own loop (Claude Code, Codex)
   and API models, nor read what a role is.
3. Roles as files, stations as a line, providers as assignments.

## Consequences
- Positive: a role is read, changed and reviewed as text; any agent can play it; the user sees and approves every
  plan, and pays only what they confirmed.
- Negative: a change to a role's text is a change to the local agents, measured by a new evaluation round of the
  Nuclear Developer; every provider needs an adapter tested against its installed command line.

## References
- Amends: ADR-platform-0003
- Spec: [011 — the software factory](../04-specs/011-software-factory/requirements.md)
- The role folder: ADR-developer-0002
