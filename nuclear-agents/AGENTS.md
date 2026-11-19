# The agents

The AI agents of the platform that run on the developer's machine. Each agent is a project in its own folder, with
its own `AGENTS.md` and `docs/`. Today there is one.

| Agent | Folder | What it is | ADR key |
|---|---|---|---|
| Nuclear Developer | [`nuclear_developer/`](nuclear_developer/AGENTS.md) | the local agents (coder, tester, security reviewer, planner, analyst, documenter, diagnoser, acceptor, assistant) on models of at most 3B parameters, as the junior developer of a frontier model | `developer` |

The roles of the software factory (spec 011, ADR-platform-0005) are [`roles/`](roles/README.md): one folder per role
(`analyst`, `architect`, `developer`, `qa`, `devops`) with its `role.md`, skills, templates, checks and roster, the
one source every agent and provider reads (ADR-developer-0002), with each employee's gender, LinkedIn-like profile, face (painted
on this machine by a local image model, driven by `roles/faces.nuc`: ADR-developer-0003) and temperament (the
compendium `roles/temperaments.json`). Its checks are `nuclear_developer/test/roles_test.nuc` and
`roles/tests/` (the faces and temperaments: [`roles/README.md`](roles/README.md));
a change to a skill that is a prompt is an evaluation round of the Developer.

The library of skills and agents (spec 011 requirement 34) is [`skills/`](skills/README.md) and `agents/`: a
`SKILL.md` per skill (Claude Code's format: domains such as payments or offline sync, technologies such as the
Synapsis backend, practices such as TDD) and an `agent.md` per agent a team member takes as their base. A team and a
member attach them, clone them and write their own in Nuclear Builder; these files are never changed by a team. Its
checks are `roles/tests/test_library.nuc` (the front matter, the Spanish, the sections, every command real) and
Nuclear Builder's `tests/test_skills.nuc` (each skill reaches every provider whole).

## Rules of every agent here

- Open the `AGENTS.md` of the agent the task touches; this file holds nothing else.
- An agent is written in Nuclear, with Synapsis when one of its platforms fits (the root
  [`AGENTS.md`](../AGENTS.md), "Nuclear and Synapsis first").
- What an agent knows is a row of the knowledge base of the [Smart Graph](../nuclear-graph-storage/AGENTS.md),
  and every prompt a model reads is a skill of a role ([`roles/`](roles/README.md)), served by the graph: never a
  text inside the agent's code.
- The local models have at most 3B parameters, and the local agents write only Nuclear (the founding decision of
  the AI loop, ADR-platform-0003, kept by the platform: [`docs/03-adr/`](../docs/03-adr/README.md)).

## Related projects

| Need | Project |
|---|---|
| The knowledge the agents read, the server of the prompts | [`nuclear-graph-storage/`](../nuclear-graph-storage/AGENTS.md) |
| The tools a frontier model calls the agents with | [`tools/mcp/`](../tools/mcp/AGENTS.md) |
| The Builder and Nuclear Atlas of the editors, `nuclear-builder` | [`extensions/`](../extensions/AGENTS.md) |
| The set-up that installs and starts the agents | [`installer/`](../installer/AGENTS.md) |
