---
name: ollama-local-models
description: Run local models with Ollama: the platform's AI services via nuclear-builder setup (models of at most 3B for the local agents), and a Synapsis backend's own agents, tools and graphs over an Ollama connection. Use when a task needs local AI or an AI feature in a backend.
title: Local models with Ollama
title_es: Modelos locales con Ollama
description_es: Ejecutar modelos locales con Ollama: preparar los servicios de IA de la plataforma con nuclear-builder setup (modelos de 3B como máximo para los agentes locales) y dar a un backend Synapsis sus propios agentes, herramientas y grafos sobre una conexión Ollama. Úsalo cuando una tarea necesita IA local, los agentes locales o una función de IA en un backend.
kind: technology
tags: [ollama, local models, ai, llm, agent, embeddings, setup, langgraph]
---
# Local models with Ollama

## When to use

Two different jobs share Ollama:

- **The platform's AI services** on the developer's machine: the Smart Graph and the Nuclear Developer, whose local
  agents run on models of at most 3B parameters.
- **A product's own AI feature**: a backend with an agent, tools or a graph over an `Ollama` connection.

Read `nuclear help ai-setup` for the first and `nuclear help backend` §2.8, §2.10–2.12 for the second.

## Steps: the AI services

1. `nuclear-builder setup --plan --json`: the machine, the profiles and how each sits on it.
2. `nuclear-builder setup` asks step by step; without questions: `nuclear-builder setup --profile medium --yes`.
   Profiles: `lite` (`qwen2.5-coder:1.5b`), `medium` (`qwen2.5-coder:3b`), `hard` (`qwen2.5-coder:3b` +
   `gemma4:e2b`), `remote` (no local model: the Smart Graph and the MCP server). The Smart Graph runs its own model
   (EmbeddingGemma in ONNX), not an Ollama one. Ollama is installed for you when a local profile needs it.
3. `nuclear-builder setup --status` says what is installed and running; `nuclear-builder setup --restart developer`
   restarts a service; `nuclear-builder setup --clients` adds the MCP server to a client installed later.
4. Agents then reach the graph and the local developer through the MCP server (`graph_strategy`, `graph_search`,
   `developer_task`, `developer_review`).

## Steps: AI in a backend

1. Enable the plugins in `config.nuc`: `plugins(sqlite = true, ai = true, ollama = true)` (add `chroma` for a
   vector store).
2. Add the connection to `config/project_config.nuc`, from the environment:
   `Ollama(model = env("CHAT_MODEL", "<model>"), baseUrl = env("OLLAMA_URL", "http://localhost:11434"))`; vectors
   with `Embeddings(model = "ollama:nomic-embed-text")` and `Chroma(collection, embeddings, url)`.
3. Make the pieces: `nuclear make tools <component> <Name>` (each method with a doc comment is a tool, its
   parameters the schema, its return a `string`), `nuclear make agent <component> <Name>` (a `prompt` and its tools,
   memory per thread: `~agent.ask(text, thread = "...")`), `nuclear make state <component> <Name>` for a graph's state.
   `make` has no `graph` kind: write the `graph` by hand in `components/<c>/ai/` (`@state(PlanState)`, `@start`,
   `@next("node")`, `"end"` ends; `~chatModel()`, `textOf(reply)`), following the reference's example.
4. Tools call the component's facade, never a repository directly.
5. Test without a model: `FakeModel(["answer"])` is a chat model with fixed answers.
6. `nuclear check . --json`, `nuclear install`, `nuclear test`, then `ollama pull <model>` and `nuclear run`.
7. Read a full example: `nuclear help example/tasks_api` (an assistant agent and a planner graph).

## The platform's tools

- `nuclear-builder setup [--profile remote|lite|medium|hard] [--yes]`, `--status`, `--plan --json`, `--clients`,
  `--restart graph|developer`, `--remove`.
- Backend words (both `fastapi` and `nestjs`): kinds `tools`, `agent`, `state`, `graph`; decorators `@start`,
  `@next`, `@state` (`nuclear help agent --dialect fastapi`).
- Mobile apps use the `genkit` plugin with cloud providers (`nuclear help genkit`): no Ollama connection there.
  The web platform has no AI kinds yet.

## Pitfalls

- Confusing the two jobs: the 3B limit is the platform's local agents' rule; a product picks the model its feature
  needs, from `env(...)` so each machine can change it.
- `tools`, `agent`, `state`, `graph` without `plugins(ai = true)`: N0304, with the line to add.
- An agent that invents ids: say in its `prompt` to use the tools and never invent ids.
- A tool without a doc comment is a helper, not a tool: the model never sees it.
- Tests that call a real Ollama: slow and flaky. Use `FakeModel`.
- `nuclear-builder setup --remove` keeps Ollama and its models; `ollama rm <model>` frees the disk.
- A port already taken: the set-up picks the next free one and writes it to `ai.env`.

## Checklist

- [ ] `nuclear-builder setup --status` shows the graph and the developer running (for the local agents).
- [ ] The backend enables `ai` and `ollama`; the model and URL come from `env(...)`.
- [ ] Every tool has a doc comment and calls the facade.
- [ ] Agents and graphs are tested with `FakeModel`, offline.
- [ ] `nuclear check . --json` prints `[]` and `nuclear test` is green.
