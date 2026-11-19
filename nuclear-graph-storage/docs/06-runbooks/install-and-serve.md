---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [update-the-knowledge-base.md, ../05-standards/security.md, ../02-architecture/integrations.md]
---
# Install, serve and ask

## Install

The set-up of the AI services installs the graph, loads the knowledge base and starts it at every login
(`nuclear-builder setup`, the installer's last step, or the wizard of VS Code:
[Set up the AI services](../../../installer/docs/08-guides/ai-setup.md)).

From the working tree, `installer/install.sh --ai` installs the platform and then runs the same set-up: the graph
is then this folder, installed editable.

By hand: it needs Python 3.12+, [uv](https://docs.astral.sh/uv/) and the NuclearLang commands on the `PATH` (no
Ollama: the graph runs its embeddings model itself). From the root of the tree:

```sh
nuclear build nuclear-graph-storage                               # the graph is written in Nuclear: its Python package
uv tool install --editable './nuclear-graph-storage[server]'     # nuclear-graph on the PATH
nuclear-graph model                                               # EmbeddingGemma in ONNX, once, into the data folder
nuclear-graph serve &                                             # the graph, on 127.0.0.1:7878
nuclear-graph knowledge build                                     # the knowledge base: nuclear-graph-storage/data/assets
nuclear-graph ingest                                              # the graph learns it (≈2 min the first time)
nuclear-graph stats                                               # the rows of each shelf and the revision it holds
nuclear-graph knowledge ask                                       # the questions people ask: each finds its row
(cd tools/mcp && nuclear build .) && uv tool install tools/mcp    # nuclear-mcp, the MCP server, on the PATH
```

A machine set up for remote agents only installs the MCP server alone (`uv tool install tools/mcp`): no graph runs
on it.

## Give the programs access

```sh
nuclear-graph connect mcp --scopes read,write                 # the MCP server
nuclear-graph connect nuclear-developer --scopes read,write   # the local agents
```

Every access command: [security](../05-standards/security.md#who-may-read-it). Adding the MCP server to a client
(`claude mcp add nuclear -- nuclear-mcp`): the project [`tools/mcp`](../../../tools/mcp/AGENTS.md).

## Ask it from a terminal

| Command | What it gives |
|---|---|
| `nuclear-graph search "<query>" [-c <shelf>] [-k 5] [-p <platform>] [--agents] [--full]` | the cards that answer a query, by meaning and by exact name; `--agents`: only what the local agents read; `--full`: each row whole |
| `nuclear-graph card <id>` | one row by its id, with what it links to |
| `nuclear-graph answer "<question>" [-p <platform>] [--history "you: ..."]` | what the graph gives for a question before a model answers it: the exact facts, then the cards |
| `nuclear-graph strategy "<request>" [-p <platform>] [--full]` | which kind of request a text is; `--full`: the plan of the strategy |
| `nuclear-graph stats` | the rows of each collection and the revision of the base the graph holds |
| `nuclear-graph web-key brave < key.txt` | keeps the key of a search engine for the local agents |

## Settings

| Variable | Default |
|---|---|
| `NUCLEAR_GRAPH_PORT` / `NUCLEAR_GRAPH_URL` | the environment's, else `NUCLEAR_GRAPH_PORT` of `ai.env` (the port the set-up chose when 7878 was held), else `7878` / `http://127.0.0.1:<port>` |
| `NUCLEAR_GRAPH_HOME` | `$XDG_DATA_HOME/nuclear-graph` |
| `NUCLEAR_GRAPH_EMBED_FILE` | `model_quantized` (int8; another export of the same model: `model`, `model_fp16`, `model_q4`) |
| `NUCLEAR_GRAPH_TOKEN` (a client) | the token `nuclear-graph connect <client>` stored |
| `NUCLEAR_SEARXNG_URL` (the internet tools) | none: Brave when its key is kept, else Wikipedia |
| `NUCLEAR_DEVELOPER_URL` (MCP) | `http://127.0.0.1:7879` |
| `NUCLEAR_AI_MODE` (MCP) | the mode of `~/.config/nuclearlang/ai.env`, else `local`; `remote`: no `graph_*` nor `developer_*` tools |
| `NUCLEAR_ROOT` (`knowledge`, `ingest`) | this checkout's working tree |

## When it fails

| What is seen | What to do |
|---|---|
| `the graph is not running at <url>: start it with nuclear-graph serve` | start it; a machine set up by the installer restarts it at login |
| `401`, `a token is needed: ask for access (POST /v1/access) and let the user allow it` | `nuclear-graph connect <client> --scopes read,write`, with the graph running |
| `'<client>' has no access to the Nuclear Smart Graph` | the same |
| `the graph holds revision N and the knowledge base is revision M` (`knowledge check`) | `nuclear-graph ingest` |

A graph started at login may run before the keyring opens: it waits for the keyring, then refuses, and never makes
a second key or token.
