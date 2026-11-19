---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [overview.md, ../05-standards/testing.md, ../06-runbooks/run.md, ../06-runbooks/evaluation.md]
---
# The models

Two models, both on Ollama (`config/project_config.nuc`): a small coder model writes the code (`CODER_MODEL`,
`qwen2.5-coder:3b`), a small general model plans, reviews and analyses (`ASSISTANT_MODEL`, `gemma4:e2b`). The chat
(`/developer/chat`) answers with a third, small one of its own, so a message never loads the factory's models
(below, "The chat's model").
Neither may be larger than 3B parameters of effective size (the user's rule). Each runs with a context window of
`CONTEXT_TOKENS` (8192 by default).

## The models: a profile for the machine

| Profile | Models | Downloads | Memory | Measured with the Developer's evaluation |
|---|---|---|---|---|
| `lite` | `qwen2.5-coder:1.5b` | 1.6 GB | 8 GB (4 GB at least) | not measured yet |
| `medium` | `qwen2.5-coder:3b` | 2.5 GB | 12 GB (8 GB at least) | as coder, the model of hard: 43 of 45 single-file tasks, 16 of 18 never seen; as assistant, 6 of the first 8 chat questions (hard: 10 of 10) |
| `hard` | `qwen2.5-coder:3b` + `gemma4:e2b` | 9.7 GB | 24 GB (16 GB at least) | 43 of 45 single-file tasks (Claude Sonnet: 39), 16 of 18 never seen, 2 of 3 whole features, 10 of 10 chat questions, 10 of 11 analyses |
| `remote` | none | nothing but the MCP server (33 MB) | any | nothing runs on the machine |

Every local profile also downloads `embeddinggemma` (0.6 GB, counted above), which makes the graph's vectors.

The set-up of the AI services suggests the heaviest profile that runs well with the machine's memory; the choice is
the user's, and a profile's models are the defaults of `CODER_MODEL` and `ASSISTANT_MODEL` on that machine
([the set-up](../../../../installer/docs/08-guides/ai-setup.md)). How each was measured: `eval/run.py chat`,
`analyze` and `local` against a Developer started with those models. `lite`, and `medium` as assistant beyond 8
chat questions, are not measured yet.

## Models measured

What other models do in the place of the two in use: one run each of the evaluation on a side Developer (2026-11-13
and 14), on a Ryzen AI 9 HX 370 with 28 GB whose Radeon 890M Ollama uses as a GPU. The prompts and the knowledge
base were tuned with `qwen2.5-coder:3b`, which favours its family. The machine these models are chosen for is
smaller: a Core i5 of the 12th generation, 16 GB, no GPU.

As coder (`eval/run.py local`: 42 single files and 3 whole features), with `gemma4:e2b` as assistant:

| Coder | Passes (45) | Files (42) | Features (3) | Median per file |
|---|---|---|---|---|
| `qwen2.5-coder:7b` (7.6B) | 45 | 42 | 3 | 7.0 s |
| `qwen2.5-coder:3b` (in use) | 43 | 41 | 2 | 3.5 s |
| `gemma4:e2b` | 41 | 38 | 3 | 14.1 s |
| `llama3.2:3b` | 39 | 37 | 2 | 3.9 s |
| `qwen2.5-coder:1.5b` | 34 | 33 | 1 | 2.0 s |
| `qwen2.5-coder:0.5b` | 32 | 31 | 1 | 1.2 s |

Without a whole round as coder: `gemma4:e4b` (41 of 42 files at 19.5 s each; its features did not run: it loads
about 10 GB), `qwen3.5:2b` and `qwen3.5:4b` (they think before they answer: 4–5 minutes per file), `llama3.2:1b`
and `phi3:3.8b` (answers that never end: 5 calls without an answer each in under 15 tasks),
`nemotron-3.5-bolt:e4b` (not run).

As assistant and analyst (`eval/run.py chat`, 14 questions; `eval/run.py analyze`, 11 requests), with
`qwen2.5-coder:3b` as coder:

| Assistant | Chat (14) | Time of the chat | Analyses (11) |
|---|---|---|---|
| `gemma4:e2b` (in use) | 14 | 316 s | 9 |
| `qwen2.5-coder:7b` | 13 (one without an answer in 3 minutes) | 686 s | 9 |
| `llama3.2:3b` | 13 | 351 s | 6 (none of the 5 that ask the model) |
| `qwen2.5-coder:3b` | 8 of the first 9, the tenth unanswered in 10 minutes | — | the first call unanswered in 15 minutes |

Not measured as assistant: `gemma4:e4b`, `qwen3.5:2b`, `qwen3.5:4b`, `nemotron-3.5-bolt:e4b`, `qwen2.5-coder:1.5b`.

On the CPU alone (one cold call of 3 400 prompt tokens with `num_gpu = 0` and 6 threads; not a round of the
evaluation, and not on an i5):

| Model | Loaded | Reads the prompt | Writes | The call | The same call on the GPU |
|---|---|---|---|---|---|
| `qwen2.5-coder:3b` | 2.4 GB | 143 tokens/s | 26 tokens/s | 27 s | 6 s |
| `qwen2.5-coder:7b` | 5.5 GB | 67 tokens/s | 13 tokens/s | 58 s | 13 s |
| `gemma4:e2b` | 6.9 GB by `ollama ps` (3.3–5.4 GB resident) | 198 tokens/s | 33 tokens/s | 26 s | 11 s |

What follows from them:

- Among the models of 3B or less nothing beats the pair in use: `qwen2.5-coder:3b` writes the best code and
  `gemma4:e2b` is the one that answers and analyses without stalling.
- One model for everything: `gemma4:e2b` works (41 of 45, four times slower per file); `qwen2.5-coder:3b` does not
  (its chat and its analyses do not end); `qwen2.5-coder:7b` works (45 of 45, chat 13 of 14 in twice the time).
- `qwen2.5-coder:7b` as coder next to `gemma4:e2b` is the best measured (45 of 45, chat 14 of 14, analyses 9 of
  11) and loads 11–12 GB: not for a machine of 16 GB. Alone it loads 5.5 GB.

Which profiles the set-up offers after these measures is a decision of the installer, still open: its roadmap
(`installer/docs/01-product/roadmap.md`).

## The chat's model

`CHAT_MODEL` (`qwen3.5:2b`), with a context of `CHAT_CONTEXT_TOKENS` (4096), no thinking (`reasoning = false`), an
answer of 1024 tokens at most (without it `qwen2.5:1.5b` wrote 35 000 tokens, Ollama shifting its context, until its
caller was killed) and `CHAT_KEEP_ALIVE` (3m): Ollama frees it three minutes after the last message. The set-up
writes it with the profile (`lite`: its one model). The graph's `embeddinggemma` still embeds the question: the
cards are what make a knowledge answer right (the exact `nuclear gen resource` command), so retrieval stays; Ollama
frees it five minutes after.

Measured on 2026-11-18 (Ryzen AI 9 HX 370, 28 GB, Radeon 890M; the GPU's memory is the system's), each model alone
(`free -m` before and after loading it):

| Model | `ollama ps` | Memory it takes |
|---|---|---|
| `gemma4:e2b` (the chat's model before) | 1.8 GB | 7.9 GB (5.1B parameters with its audio and image parts; 8192 or 4096 of context the same) |
| `qwen3.5:2b` (in use) | 2.4 GB | 4.1 GB |
| `qwen3.5:2b-q4_K_M` | 1.6 GB | 3.2 GB |
| `qwen2.5:1.5b` | 1.2 GB | 1.7 GB |
| `embeddinggemma` | 0.7 GB | 1.7 GB |

A chat message through Nuclear Builder's member took 9–10 GB with `gemma4:e2b` (the first answer 37 s, cold) and
5.7 GB with `qwen3.5:2b` (13 s cold, 10 s the next). The member's prompt was 20 900 characters (the factory's 55
tools described, four cards searched with the whole prompt, the assistant's guide); with `query` and the tools a
chat calls most it is 8 700 (2 200 tokens).

Five chat messages (a greeting in Spanish, "who are you" in English, a spec with its criteria in Spanish, how to
write a CRUD resource in English, the project's specs in Spanish), through the member with each model as
`CHAT_MODEL`:

| Model | Answers right | Per message |
|---|---|---|
| `qwen3.5:2b` | 3: the language every time, `spec_new` right, the resource from the cards; "who are you" says the Developer, and the project's specs are answered without `spec_list` | 9–11 s |
| `qwen3.5:2b-q4_K_M` | 2: it invented a tool's result for the resource | 6–8 s |
| `qwen2.5:1.5b` | 2: `spec_new` and the resource; it repeats the greeting and recites its prompt | 3–8 s |
| `gemma4:e2b` | 2: `spec_new` and `spec_list`; the greeting and "who are you" loop on tools for six rounds | 7–44 s |
| `llama3.2:3b` | 1: tool calls loop and repeat `spec_new` | 8–112 s |
| `llama3.2:1b` | 0 | 3–36 s |

