---
status: accepted
date: 2026-11-20
deciders: Julian Molina
---
# ADR-platform-0013: The local models are on standby; the AI work is done by external providers and agents

## Context and problem
NuclearLang ran local LLMs through Ollama: the Nuclear Developer service, the `local` kind of Nuclear Builder's
members, the profiles `lite`, `medium` and `hard` of the AI set-up, the local chat of Nuclear Chat and Nuclear Atlas.
The user decided (2026-11-20) to put all of it on standby and work only with external AI providers (APIs) and
agents (Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Grok).

## Decision
- **One switch, off**: `localModels: false` in Nuclear Builder's `setup.json` (shipped in its package). Every part
  that runs or offers a local model reads it, directly (Nuclear Builder: the set-up, the engine, the chat) or through
  the JSON of the `nuclear-builder` commands the editors already run (`setup --plan --json` carries `localModels`).
  The MCP server mirrors it in one constant, held to `setup.json` by a test.
- With the switch off nothing local is offered, installed, started or listed: the set-up has only the profile
  `remote` (the Smart Graph and the MCP server); the installers never install Ollama, a local model or the Developer;
  Nuclear Builder has no `local` kind and no Ollama models in its pickers; the MCP server registers no `developer_*`
  tool; the editors show no local model, profile, Ollama step or Developer status.
- **Nuclear Atlas** is answered by an external provider or agent the user picks, over the Smart Graph, as Nuclear
  Chat's members are.
- **Existing installations**: an update takes away everything local NuclearLang put there: the Developer's service,
  the models NuclearLang downloaded, and Ollama when NuclearLang installed it (what was on the machine before stays,
  ADR-installer-0005). A team member or a setting that named the local kind or a local model is converted on read
  to the default external choice, the old file kept as `.bak`, and the user is told.
- **The Smart Graph is not touched**: it runs its own embeddings model (no Ollama, ADR-graph-0003), in the profile
  `remote` as before.
- The code stays in the repository, untested by default; turning the switch on again is a decision of the user and
  needs its own tests on that day.

## Consequences
Lighter installs (no GB of models, no Ollama), one way of working (paid or subscribed providers), fewer services to
keep alive. The knowledge base says the local models are on standby.
