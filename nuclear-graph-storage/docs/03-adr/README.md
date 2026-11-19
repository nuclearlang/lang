# Decisions of the Smart Graph

Key: `graph`. Cite as `ADR-graph-NNNN`. The format is the platform's
[`0000-template.md`](../../../docs/03-adr/0000-template.md). An accepted ADR is not edited: a new one replaces it.
The founding decision of the AI loop is the platform's (ADR-platform-0003).

| ADR | Decision | Status |
|---|---|---|
| [ADR-graph-0001](0001-a-library-of-typed-linked-versioned-rows.md) | The Smart Graph is a library of typed, linked, versioned rows | accepted |
| [ADR-graph-0002](0002-exact-facts-a-query-planner-and-the-graph-in-nuclear.md) | Questions with one right answer are answered from exact facts by a query planner; the Smart Graph is written in Nuclear | accepted |
| [ADR-graph-0003](0003-the-graph-runs-its-own-embeddings-model.md) | The graph runs its own embeddings model (EmbeddingGemma in ONNX, int8), with no Ollama | accepted |

The strategies, whose rows live on the `playbooks` shelf and whose selection is here, are a decision of the Nuclear
Developer: [ADR-developer-0001](../../../nuclear-agents/nuclear_developer/docs/03-adr/0001-a-strategy-for-each-kind-of-request.md).

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../docs/03-adr/old-numbers.md).
