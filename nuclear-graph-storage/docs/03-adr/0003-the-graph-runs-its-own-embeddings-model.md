---
status: accepted
date: 2026-11-19
deciders: Julian Molina
---
# ADR-graph-0003: The graph runs its own embeddings model (EmbeddingGemma in ONNX), with no Ollama

## Context and problem
The graph's vectors came from `embeddinggemma` on Ollama. The MCP server reads the graph in every profile
(ADR-installer-0004), so even a user with remote agents only had to install Ollama, often through Homebrew or an
installer that asks for a password, just for the graph. The user asked for the graph to need nothing else, on every
system, with the same quality.

## Decision
- The graph embeds with EmbeddingGemma exported to ONNX (`onnx-community/embeddinggemma-300m-ONNX`, not gated, Gemma
  licence), run inside the server's process by ONNX Runtime and `tokenizers`. Both were already in the graph's
  environment (Chroma depends on them), so the AI archive gains no library and no system is lost.
- The int8 export (`model_quantized`, 309 MB) is the default; `NUCLEAR_GRAPH_EMBED_FILE` chooses another.
- Its files are downloaded once from Hugging Face into the data folder's `models/` as real files (`nuclear-graph
  model`, a step of the set-up; else the first search). Hugging Face's cache keeps links to its blobs, which ONNX
  Runtime refuses for a model's data file.
- Texts are embedded in batches of at most 4096 tokens, the shortest first, without ONNX Runtime's memory arena: the
  memory of a batch grows with the square of its longest text.
- Each release computes the vectors of its knowledge base once (`nuclear-graph embeddings`, the release's job
  `embeddings`) and publishes them as `nuclearlang-embeddings-<version>.npz` with its `.sha256`: one file for every
  system, since a vector depends only on the text and the model. The set-up downloads it into the data folder
  (`models/embeddings.npz`); an ingest takes each vector it holds (keyed by the export and the exact text) and gives
  only the rest to the model, which is then loaded only if something is missing. The store itself cannot be shipped:
  its documents are sealed with a key of each machine.

## Options considered (measured on 2026-11-19 with the 188 questions of `data/questions.toml`)

| Embeddings | Found | First | Download | Ingest of the base |
|---|---|---|---|---|
| `embeddinggemma` on Ollama (BF16, the GPU) | 188 | 177 | 621 MB + Ollama | 160 s |
| ONNX fp32 | 186 | 176 | 1.2 GB | 521 s |
| ONNX fp16 | 186 | 176 | 617 MB | 887 s |
| **ONNX int8 (chosen)** | **187** | **178** | **309 MB** | 566 s |
| ONNX q4 | 185 | 179 | 197 MB | 616 s |

The ONNX exports and Ollama give the same vector for a short text (cosine 1.0000) and drift apart as a text grows
(0.94 at 1700 tokens): the two run Gemma's attention differently on long inputs. The questions missed are near ties
(the expected row third instead of first, fourth instead of third).

## Consequences
- Positive: the graph needs nothing on the machine; `remote` installs no Ollama; the model is half Ollama's size.
- Negative: without the release's vectors (a release before 0.1.8, no connection) the first ingest takes about 9
  minutes on a processor instead of under 3 with Ollama on a GPU, and up to about 2.3 GB of memory while it runs
  (1.1 GB after it); with them it takes seconds. Later ingests embed only what changed. One question
  of the 188 is missed: "how do I delete or close a conversation and search old messages in nuclear chat" finds
  `can:workplace-chat` fourth instead of in the first three.

## References
- ADR-installer-0004 (the graph in every profile); `store.nuc` (`LocalModel`, `modelFolder`); `cli.nuc` (`model`).
