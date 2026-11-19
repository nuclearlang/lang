---
status: accepted
date: 2026-11-19
deciders: Julian Molina
---
# ADR-installer-0004: The Smart Graph runs in every profile; what is on the machine is used, a model is asked for

## Context and problem
The profile `remote` installed only the MCP server: nothing ran on the machine. But the MCP server's strategy and
search tools read the Smart Graph, so with `remote` an agent got an MCP server whose graph tools had no graph. The
first install on macOS (2026-11-19) also showed that the set-up stopped when Ollama was installed but not running,
and downloaded every model without asking, even when the user had them.

## Decision
- The Smart Graph, its model and its knowledge base are installed and started in every profile, `remote` included.
  The graph runs its model itself, inside its own process (EmbeddingGemma in ONNX, 0.3 GB; ADR-graph-0003), so
  Ollama stays a requirement of the local profiles only. `remote` runs the graph alone; the local profiles add the
  Nuclear Developer and the chat.
- A requirement already on the machine is used with no question. An Ollama that is installed but stopped is started
  by the set-up (its app on macOS, else `ollama serve`).
- The models Ollama already has are used as they are. The Smart Graph's model is downloaded without a question (the
  MCP server needs it); the local agents' Ollama models that are missing are listed with the size and downloaded
  only when the user says yes (`--yes`: without asking).

## Consequences
- Positive: an agent on any profile gets the whole MCP server, strategy and search included; nothing the user has is
  downloaded again.
- Negative: `remote` now downloads 0.3 GB and runs one service at login.

## References
- ADR-installer-0002, ADR-installer-0003; `extensions/tools/nuclear-builder/setup.nuc` (`steps`, `servicesOf`,
  `modelsOf`), `cli.nuc` (`haveRequirements`, `haveModels`); [the guide](../08-guides/ai-setup.md).
