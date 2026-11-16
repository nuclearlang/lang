---
status: accepted
date: 2026-11-11
deciders: Julian Molina
---
# ADR-0003: The AI loop: a private knowledge base, local agents, one MCP server and a pipeline tool

## Context and problem
The user wants spec-driven work inside the editor: a spec goes through plan, tests, code, verification, security,
artifacts and deploy on the developer's machine, and the same pipeline runs on a server. A frontier model must not
do all the work: it leads, and hands each piece to a local model of at most 3B parameters, as a lead hands work to
a junior. A model that small cannot hold much context, and the machine has no GPU to train one.

## Decision
Four projects, each with its own documents:

1. **The Smart Graph** (`nuclear-graph-storage/`): the knowledge base of the whole platform, on the developer's
   machine. It is private: only its server opens the store, it listens on the loopback address, each program asks
   for access and the user allows it, and what it stores is encrypted.
2. **The MCP server** (`tools/mcp/`): one server gives any agent the graph, the compiler, a project's commands and
   the local developer.
3. **The Nuclear Developer** (`nuclear-agents/nuclear_developer/`): the local agents, written in Nuclear. Each runs
   fixed steps (recall from the graph, write, check with the compiler, repair), because a small model follows steps
   better than it chooses tools.
4. **The pipeline tool** (`extensions/tools/nuclear-builder/`): the spec form, the runs and the pipeline in the
   editor, and the same engine as a command.

Rules that hold across the four:

- **Local models have at most 3B parameters.** They learn by retrieval and distillation, not by training weights:
  a frontier model answers a task bank once, its answers that pass the compiler become examples of the graph, and
  the local agents are measured against it. A failure is fixed with a general rule or knowledge in the graph, never
  with the answer.
- **The local agents write only Nuclear.** They name a platform (`backend`, `mobile`, `web`), never a dialect or a
  target language, and read only what is written for them.
- **The tools write; the agents think the business logic.** The compiler writes the project's map, the platform
  says where each kind goes and its smallest file, the generators write what is standard.
- **Over MCP the local developer works first**: a frontier model gives every task that writes `.nuc` to the local
  developer, then validates, corrects and records its review.
- **The agents' prompts are files** of the graph, never text inside the agents' code.
- **A failure is diagnosed before it is retried**: what may pass on a second try is retried with backoff; a
  compiler error or a failing test goes to the repair rounds.

## Options considered
1. A frontier model does everything: every token is paid and the code leaves the machine.
2. Training the local model's weights: days per round without a GPU.
3. Retrieval and distillation over a local knowledge base, with a frontier model as lead.

## Consequences
- Positive: most of the work runs on the developer's machine; what the agents know is data that can be read,
  measured and corrected.
- Negative: every change to an agent, a prompt or the knowledge base is a new round of the evaluation; the
  knowledge base must follow the tree.

## References
- Replaces: ADR-0102
- The parts: `ADR-graph-*`, `ADR-developer-*`, `ADR-codegen-*`, `ADR-installer-*`
