# The agents

The AI agents of NuclearLang that run on the developer's machine. Each agent is a project in its own folder. Today
there is one: the [Nuclear Developer](nuclear_developer/README.md), the local agents (coder, tester, security
reviewer, planner and more) that work as the junior developer of a frontier model.

## Why it exists

Spec-driven work with AI should not need a frontier model for every token, nor send the code off the machine. The
agents here do the writing locally, on small models, while a lead (Claude, or you) makes the decisions.

## How we made it

- **The AI loop** ([ADR-platform-0003](../docs/03-adr/0003-the-ai-loop.md)): local models of at most 3B
  parameters, which write only Nuclear and name a platform, never a dialect. They learn by retrieval and
  distillation, not by training weights.
- **What an agent knows is a row of the [Smart Graph](../nuclear-graph-storage/README.md)**, and every prompt a
  model reads is a file of the graph's `prompts/`: never text inside the agent's code.
- **Written in Nuclear**, with Synapsis when one of its platforms fits (the root [`AGENTS.md`](../AGENTS.md),
  rule 9): the Nuclear Developer is a Synapsis backend.
- **Tools before models** ([ADR-platform-0004](../docs/03-adr/0004-products-are-made-with-the-tools.md)): an agent
  writes only what no generator, compiler fix or rename tool can write.

## Try it

```sh
nuclear-builder setup            # installs the Smart Graph, the Nuclear Developer and the models that fit the machine
nuclear-builder setup --status   # what is installed and running
```

What to ask it next: [the Nuclear Developer](nuclear_developer/README.md#try-it).

## Where to read next

| | |
|---|---|
| The Nuclear Developer | [nuclear_developer/README.md](nuclear_developer/README.md) |
| The knowledge the agents read, the prompts | [the Smart Graph](../nuclear-graph-storage/README.md) |
| The tools a frontier model calls the agents with | [the MCP server](../tools/mcp/AGENTS.md) |
| The Builder and Nuclear Atlas of the editors | [Nuclear Builder](../extensions/tools/nuclear-builder/README.md), [Nuclear Atlas](../extensions/tools/nuclear-atlas/README.md) |
| The set-up that installs and starts the agents | [Set up the AI services](../installer/docs/08-guides/ai-setup.md) |
| To add or change an agent | [AGENTS.md](AGENTS.md) |
