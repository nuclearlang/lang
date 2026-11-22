# Changelog

All notable changes to nuclear-graph are written here; versions follow [Semantic Versioning](https://semver.org).

## Unreleased

- A row per helper of the language (`lib:helper-<name>`), read from the helpers' sources and their tests' cases; the conformance, semantics and benchmark programs are examples, each with what it prints; three capabilities (`can:helpers`, `can:tested-in-every-dialect`, `can:backend-errors`) and ten questions about them.
- 0.80.0: the platform's one version (ADR-platform-0011): every project of NuclearLang carries the same version and a release is one snapshot of all of them; the release builds nothing when the knowledge base was not built at the tag's version (its component rows name each one's version).
- The vectors of the knowledge base come with each release (`nuclearlang-embeddings-<version>.npz`, one file for every
  system, made by `nuclear-graph embeddings`): an ingest takes them instead of running the model over every row, so
  an install loads the base in seconds; a text the file does not hold goes to the model.
- The embeddings no longer need Ollama (ADR-graph-0003): EmbeddingGemma in ONNX runs inside the server's process
  (ONNX Runtime and `tokenizers`, already the store's), the same model and the same vectors as before. Its files come
  from Hugging Face once, into the data folder's `models/`; `nuclear-graph model` downloads them ahead.
- The rows of `nuclear-builder`'s commands come from its Nuclear command line (`cli.nuc`, whose help prints each
  command at the first column) and a command with several forms (`setup --status`, `run --resume`) is one row with
  every form; `team`, `vault` and `checks` have their rows. The `stage:*` rows are the software factory's six
  stations (`stage:analysis` … `stage:delivery`), read from its engine (`run.nuc`, `roles.nuc`) since the TypeScript
  engine is gone; `concept:loop` describes the factory, and the rows that linked the nine old stages link the
  stations (`deploy` → `tool:nuclear-builder.ci`).
- The prompts moved into the roles of the software factory (`nuclear-agents/roles/<role>/skills/`, spec 011,
  ADR-developer-0002), with the same text: `ingest` reads every skill whose front matter names a `prompt` and keeps
  the text after the front matter (`Paths.roles`, was `Paths.prompts`); the package carries `nuclear_graph/roles`; a
  prompt named by two skills is refused. The folder `prompts/` is gone. The software factory is a row
  (`concept:software-factory`).
- The constants of a file are read by the others as they are (`SHELVES`, `PLATFORMS`...): the compiler imports them
  now, so the functions that only returned them (`shelfTable()`, `platformNames()`...) and `toolchain.nuc`'s copy of
  the platforms are gone; the path of the platforms is `PLATFORMS_DIR` (it took the name of the list).
- The port comes from the environment, else from `NUCLEAR_GRAPH_PORT` of `ai.env` (the one the set-up chose when 7878 was
  held, ADR-installer-0003), else 7878: a shell that never read `ai.env` reaches the graph (`machineValues` in
  `paths.nuc`; `Paths.machine()` gives the same).
- The editors' tools are named as the extensions name them: HTTP Connections (was Nuclear Connector) and Nuclear
  Atlas (was the chat, *Nuclear agent*), in the summary of the tools (`extract_tools.nuc`) and in the rows.
- MCP: the `synapsis` tool runs `remove` too, and `nuclear_defs` takes the project's folder to show the packages the
  project added (ADR-lang-0008).
- The planner runs a query of the exact facts only when its exact question is closer to what was asked than the
  closest card of the shelves (ADR-graph-0002): "que es nuclear lang?" was answered with every command of `nuclear`,
  because the question writes the tool's name; so were "what is the smart graph" (47 rows) and "how does the mcp
  work" (27). `knowledge ask` holds the open questions marked `exact = false` in `questions.toml` to no query.
- **The search is exact** (ADR-graph-0001): `Store.near` and `Store.measure` compare the vector the store keeps of every
  item a filter matches; Chroma's approximate index is not asked. Once rows were replaced that index did not reach
  every item it held, and which ones changed at every start of the graph (after an ingest: three cards of 2 617, and
  "ModuleNotFoundError: No module named ..." no longer found its failure). `numpy` is a dependency of the server.
- A search result's `distance` is the closest the card came by meaning, by its text or by any question it answers;
  it was the distance of whichever of them ranked it, so a card brought in by a name hid a question of its own that
  was the same as the one asked.
- **A closed keyring is waited for** (ADR-installer-0002): a graph started at login ran before the keyring opened, found no
  owner's token and made another one in a file (every `nuclear-graph` command was answered 401; the same on the
  documents' key would open no card). The names the keyring keeps are written down (`.keyring`); a secret of a closed
  keyring is waited for, then refused, and never made again.
- Every MCP tool's card answers "what does <tool> do" (a generated question of its row): the planner gave that
  question the 15 rows of `query:mcp.commands`. `query:examples` answers "an example of a <kind>"; "que hace el mcp"
  is a question of `concept:mcp`, no longer of `query:mcp.tools`.
- The package is typed (`py.typed`): a project that uses it is checked against it.
- The graph is a library (ADR-graph-0001): nine shelves (`concepts`, `language`, `platforms`, `tools`, `errors`,
  `capabilities`, `playbooks`, `examples`, `docs`) of rows with a stable id, keys, questions, typed links and sources,
  instead of two collections of document pieces (`knowledge` and `nuclear` are removed by the first ingest). Search by
  meaning and by exact name over several shelves; `GET /v1/cards/{id}`; `nuclear-graph card`, `search -p --agents`;
  MCP `graph_search` by shelf and `graph_card`.
- The knowledge base is asset files: `knowledge build` generates the rows from the working tree (`extract.py`:
  diagnostics, library, platforms, the CLIs' help, MCP tools, routes, stages, agents, editor, versions, examples,
  documents), merges the overlays, validates everything and raises the revision; `knowledge check` fails when the
  base is behind the tree; `knowledge review` confirms a hand-written row whose source changed; `knowledge ask` runs
  the questions of `questions.toml`. `ingest` takes the knowledge folder only, embeds what changed and keeps what
  agents wrote at run time. A client writes only `memory` and `examples`.
- For the agents: `POST /v1/applies` (what of a spec the platform cannot do yet, by the capabilities' trigger words),
  `GET /v1/kinds/{platform}` (how people write each kind), `GraphClient.applies | kinds | brief | card`, and
  `workspace.py`: a project's files, read-only and confined to the project (`read`, `list`, `find`, `grep`, `outline`,
  `declarations`, `context`). MCP `developer_code` takes `project` and the local coder reads the project by itself.

- First public version (ADR-platform-0003): the private knowledge base (Chroma + EmbeddingGemma, documents AES-GCM encrypted,
  key and owner token in the keyring, a server on 127.0.0.1 with per-client tokens the user allows), ingest by hash,
  the knowledge base build (`nuclear-graph knowledge build|check`, the `nuclear-knowledge` repository), the agents'
  prompts as files, the web tools (`web.py`).
- MCP server: the graph, the Nuclear Developer's agents (`developer_*`, local first, `developer_review`), and the
  generators (ADR-codegen-0001): `project_inspect`, `generate_component|resource|screen`, `api_inspect`, `web_search`,
  `web_read`.
- MCP `generate_usecase(project, component, name, calls, route, dry_run)`: `nuclear gen usecase` for a client; the instructions tell it to wire each use case the local developer wrote (ADR-codegen-0001).
- The README's tool table has `developer_retry`; a test holds every MCP tool to the README and to the documentation's
  page (`docs/ai/mcp.md` of `nuclear`), so a new tool is documented in the same change.
- Strategies (ADR-developer-0001): the row type `strategy` on the playbooks shelf (`meta`: `family`, `scope`, `triggers`; `data`: `signals`,
  `target`, `mode`, `stages`, `pieces`, `generators`, `needs`, `lead`); the selection `retrieve.strategy` (exact signs, then
  meaning; no model), `POST /v1/strategy`, `GraphClient.strategy`, `nuclear-graph strategy "<request>"`, MCP `graph_strategy`
  (the first call the server's instructions ask for); `knowledge ask` gives a `request = true` entry of `questions.toml` to
  the selection; `Workspace.renamed(old, new)`: a rename as a tool; the prompt `agents/analyze.md`.
- A machine set up for remote agents only (ADR-installer-0002; `NUCLEAR_AI_MODE=remote` in `~/.config/nuclearlang/ai.env`, or in the
  environment): the MCP server offers no `graph_*` nor `developer_*` tool and tells the model to write what the
  generators do not. The extra `mcp` installs the MCP server alone (`nuclear-graph[mcp]`); `paths.machine()` reads the
  set-up's file.
- 0.2.0: **written in Nuclear** (ADR-graph-0002; the `python` dialect, `nuclear.toml`). The `.nuc` files of the repository
  are the source, `nuclear build .` writes the package `build/nuclear_graph` that `pyproject.toml` packages; `src/`
  and the Python tests are gone (`tests/*.nuc`); the prompts are `prompts/`. `nuclear-graph knowledge examples`
  replaces `tests/check_examples.py`.
- **Exact facts and the query planner** (ADR-graph-0002): the names, summaries, links and structured fields of every row in
  a SQLite database kept in the memory of the graph's process only (made from the sealed cards at the start and at
  every ingest; nothing is written to disk), with a view per thing a question can list (`facts.nuc`); the shelf
  `queries`, the catalogue of questions with one right answer, checked at build time; the planner (`planner.nuc`):
  `POST /v1/answer`, `nuclear-graph answer "<question>" [-p platform]`, `GraphClient.answer`, MCP `graph_answer`. The
  generated rows carry what the views read as structured `data`; `knowledge ask` gives an `exact = true` entry of
  `questions.toml` to the planner.
- MCP `developer_retry(project, run, from_stage, from_step, scratch)`: a run again from any step, or from scratch.
- The prompts `chat.md` and `agents/chat.md` have an "Exact facts" section the assistant copies from;
  `agents/accept.md` holds the acceptance criteria against a run.
