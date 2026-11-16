# The agents

The AI agents of the platform that run on the developer's machine. Each agent is a project in its own folder, with
its own `AGENTS.md` and `docs/`. Today there is one.

| Agent | Folder | What it is | ADR key |
|---|---|---|---|
| Nuclear Developer | [`nuclear_developer/`](nuclear_developer/AGENTS.md) | the local agents (coder, tester, security reviewer, planner, analyst, documenter, diagnoser, acceptor, assistant) on models of at most 3B parameters, as the junior developer of a frontier model | `developer` |

## Rules of every agent here

- Open the `AGENTS.md` of the agent the task touches; this file holds nothing else.
- An agent is written in Nuclear, with Synapsis when one of its platforms fits (the root
  [`AGENTS.md`](../AGENTS.md), "Nuclear and Synapsis first").
- What an agent knows is a row of the knowledge base of the [Smart Graph](../nuclear-graph-storage/AGENTS.md),
  and every prompt a model reads is a file of the graph's `prompts/`: never a text inside the agent's code.
- The local models have at most 3B parameters, and the local agents write only Nuclear (the founding decision of
  the AI loop, ADR-platform-0003, kept by the platform: [`docs/03-adr/`](../docs/03-adr/README.md)).

## Related projects

| Need | Project |
|---|---|
| The knowledge the agents read, the prompts | [`nuclear-graph-storage/`](../nuclear-graph-storage/AGENTS.md) |
| The tools a frontier model calls the agents with | [`tools/mcp/`](../tools/mcp/AGENTS.md) |
| The Builder and the chat of the editors, `nuclear-builder` | [`extensions/`](../extensions/AGENTS.md) |
| The set-up that installs and starts the agents | [`installer/`](../installer/AGENTS.md) |
