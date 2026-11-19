---
status: accepted
date: 2026-11-17
deciders: Julian Molina
---
# ADR-0002: A role is a folder, read by the local agents and every provider

## Context and problem
The software factory (ADR-platform-0005) gives each station to a role that the local agents, a provider's agent or
a provider's model can play. What the local agents were told lived in the Smart Graph's `prompts/` folder, cut by
step of the Developer's graphs (`agents/repair.md`) and by use case of a frontier model (`feature.md`); nothing said
what an analyst, an architect or a QA is for, what it delivers or what it never does. A provider cannot play a role
that exists only as prompts of another agent's steps.

## Decision
A role is the folder `nuclear-agents/roles/<role>/`, one of `analyst`, `architect`, `developer`, `qa`, `devops` (`delivery` before spec 011's amendment):

- `role.md`: front matter `id`, `title`, `stations`, `default` (the default assignment: kind, provider, model);
  the body is the mission, the inputs, the outputs, the definition of done and what the role never does.
- `skills/*.md`: the how-tos the role may use. Each starts with front matter `name` and `description`; a skill that
  is a prompt of the Smart Graph also names it (`prompt: agent.repair`, `prompt: feature`).
- `templates/*.md`: the documents its stations write in `specs/<id>/`.
- `checks.toml`: the checks it proposes (`id`, `title`, `station`, `on`, `by` = `role` or `user`, a `command` or a
  `prompt`).
- `roster/{en,es}.json`: the employees the user can hire for the role.

Today's prompts moved into the roles' skills, with the same text. The Smart Graph's `ingest` makes its `prompts`
collection from the skills that name a prompt, so the Developer (`Workbench.prompt`, `recall`) and the MCP server
(`graph_prompt`) read them as before: the Developer's graphs keep deciding *how* a 3B model is led (recall, write,
repair with the compiler); the role's files say *what* it is asked. A provider's adapter renders the same folder in
its agent's own format.

A test of this project (`test/roles_test.nuc`) keeps every role folder complete: the five files and folders, the
front matter, each template named by the role, each prompt the agents read present once.

## Options considered
1. Keep the prompts in the graph and write each role again for every provider: two sources that drift.
2. The Developer reads the role files from the disk: a second way to the same text, and the installed Developer
   would need the tree next to it; the MCP server still needs the graph's route.
3. The role folder as the one source, served by the graph's existing `prompts` collection.

## Consequences
- Positive: one source per role; the Developer's code and routes do not change; a provider and a person read the
  same text.
- Negative: a change to a role's skill that is a prompt is an evaluation round (as a prompt change was); the graph's
  package carries the roles folder (`pyproject.toml`, the installer's staging).

## References
- ADR-platform-0005 (the software factory), ADR-platform-0003 (the AI loop)
