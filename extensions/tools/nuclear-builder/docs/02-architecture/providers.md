---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [teams-and-vault.md, engine.md, ../../../../../docs/04-specs/011-software-factory/design.md]
---
# The providers: one interface, an adapter each (`adapter*.nuc`, `api_*.nuc`)

Every provider of a role is called the same way (`adapter.nuc`):
`runAdapter(adapter, role, station, work, emit) → Outcome`.

- `Role`: composed by `composeRole(id, assigned)` from `nuclear-agents/roles/<id>/` (`role.md` with its front
  matter, the skills the team switched on, its templates and `checks.toml`) and the member's `instructions` (a base
  agent's text first) and the skills of the team and the member (`assigned.sharedSkills`, `library.nuc`
  `withSkills`: the member's own over the team's, the team's over the library's; `role.sources` says where each one
  that is not the role's comes from). Every adapter renders them as the role's skills: Claude Code's plugin
  `skills/<id>/SKILL.md`, OpenCode's `.opencode/agent/<role>.md`, Codex's `AGENTS.md`, Gemini CLI's `GEMINI.md`, an
  API model's system prompt (`role.text()`), and the local Developer's `context` (`role.sharedText()` first and whole,
  the documents in what is left); `tests/test_skills.nuc` renders every skill of the library for each one. The role's files are only read. A role whose folder is not there yet gets one line of mission
  that says so. `role.text()` is the whole role as one text.
- `Work`: the project, the spec's folder (`specs/<component>/[<layer>/]<id>/`), the task, the documents of the stations before, the documents to write, the
  model, the step's budget (USD), the MCP server's command, the timeout, and `inputs` (the platform, a route, the
  retries, an httpx transport in tests, a key, the project's prices).
- `Outcome`: ok, the last text, the documents (written into the spec's folder by an agent, else found in the answer
  after `--- document: <name> ---` lines, or the whole answer when one was asked), the project files it changed
  (two snapshots: not `build/`, `.nuclear/`, `node_modules/`…, nor the spec's folder), the cost, the events, the error.
- Events, one shape for every provider: `text`, `tool` (`id`, `tool`, `input`), `tool-result` (`id`, `ok`,
  `text`), `cost` (`usd`), `tokens`, `retry`, `trace`.
- `runAdapter` turns an exception into a failed outcome. `stationPrompt` is the task every provider gets: the role
  and station, the documents before, the templates of the documents to write.

## Who does a role

| Kind | Provider | File | How | The role becomes | The cost |
|---|---|---|---|---|---|
| `local` | `nuclear-developer` | `adapter_local.nuc` | HTTP: a route per station (`LOCAL_ROUTES`, or `inputs.route`), watched while it waits (`inputs.watch`: cut after the call's limit or `stallSeconds` with nothing working on it) and retried with `backoff` on a passing failure | the body's `role`, `task`, `context` | 0 |
| `agent` | `claude-code` | `adapter_claude_code.nuc` | `claude -p --output-format stream-json --verbose --mcp-config --strict-mcp-config --plugin-dir --append-system-prompt --tools Read,Write,Edit,Glob,Grep --allowedTools … mcp__nuclear mcp__nuclear_builder --no-session-persistence [--model] [--max-budget-usd]` | a plugin in the run's temporary folder: `skills/<name>/SKILL.md`, the sub-agent `agents/<role>.md`; and the session's system prompt | `total_cost_usd` |
| `agent` | `opencode` | `adapter_opencode.nuc` | `opencode run --agent <role> --format json --auto [--model provider/model]`, `OPENCODE_CONFIG` and `OPENCODE_CONFIG_DIR` in the temporary folder | `.opencode/agent/<role>.md` (shell denied) | the sum of `step_finish` costs |
| `agent` | `codex` | `adapter_codex.nuc` | `codex exec --json --skip-git-repo-check --sandbox workspace-write -C <root> -c mcp_servers.nuclear.* -c mcp_servers.nuclear_builder.* [--model]` | an `AGENTS.md` section, at the head of the prompt | 0 (tokens as events) |
| `agent` | `gemini-cli` | `adapter_gemini_cli.nuc` | `gemini -p --output-format stream-json --approval-mode auto_edit --allowed-mcp-server-names nuclear nuclear_builder [--model]`, the MCP servers in `GEMINI_CLI_SYSTEM_SETTINGS_PATH` | a `GEMINI.md`, at the head of the prompt (shell excluded) | 0 (tokens as events) |
| `api` | `anthropic` | `api_anthropic.nuc` | the Messages API, `anthropic-version: 2026-10-21` | the system prompt; the MCP tools as client tools | tokens × `PRICES` |
| `api` | `openai` | `api_openai.nuc` | Chat Completions | the system message; the tools as functions | tokens × the project's `prices` |
| `api` | `google` | `api_google.nuc` | `models/<model>:generateContent` (schemas without `$schema` and `additionalProperties`) | `systemInstruction`; function declarations | tokens × the project's `prices` |
| `api` | `openrouter` | `api_openrouter.nuc` | Chat Completions at OpenRouter with `usage.include` | as OpenAI | what OpenRouter reports |

- **Two MCP servers for every agent**: `nuclear-mcp` (`nuclear`: the generators, the compiler, the graph, the local
  developer) and the Builder's, `nuclear-builder mcp --root <project>` (`nuclear_builder`: every action of the
  Builder's pages, [actions.md](actions.md)), from `mcpServers(command, root)` (`adapter.nuc`); its command is
  `NUCLEAR_BUILDER_COMMAND`, else `nuclear-builder`. OpenCode gets both in its `mcp` table, Codex as `-c
  mcp_servers.*`, Gemini CLI in its settings, the API loop as two clients (each call goes to the server that has the
  tool).
- An agent's command runs in the project with the tools' PATH (`streamCommand`): each stdout line as it comes, the
  process group killed after the timeout (exit -9). The temporary folder is removed after the call: nothing goes
  into the user's files. No agent gets a shell: commands are data (`.nuclear/builder.json`).
- The API loop (`adapter_api.nuc`, `apiLoop`): `nuclear-mcp` and `nuclear-builder mcp` started in the project, `initialize`, `tools/list`,
  then up to `MAX_TURNS` (30) turns: the model answers, each tool it calls goes to the server (`tools/call`), the
  results go back. The key comes from the vault (`vaultKey`). Before every turn the step's cost is held against its
  budget; a model with no price is refused before any call (`PRICES` has Anthropic's of 2026-11-03; others go in
  `.nuclear/builder.json` `"prices": { "<provider>/<model>": [input, output] }`, USD per million tokens).
- A chat's turn (`inputs.stream`, Nuclear Chat) adds `--include-partial-messages` to `claude`: its
  `stream_event` lines' `text_delta`s are `text-delta` events, the answer as it is written; a run never streams.
- Which agents are on this machine is `nuclear-builder agents --json` (`chat_agents.nuc`, the tool `agents_list`):
  an agent when its command is on the tools' PATH (Claude Code's models are its aliases `haiku`, `sonnet`, `opus`;
  OpenCode's are `opencode models` when it answers in 5 s, else one typed by hand; Codex's and Gemini CLI's their
  own default), an API provider when the vault notes its key (`vault.json`, the keyring is not opened for a list)
  and it has a priced model (`PRICES`, the project's `prices`).
- Which models each provider offers is `nuclear-builder models [--provider <id>] [--fresh] --json` (`models.nuc`, the
  tool `models_list`), from the provider itself (spec 011 requirement 35): Claude Code its aliases `fable`, `opus`,
  `sonnet`, `haiku` and the full ids of the price table (`claude --help`: an alias or a model's full name; free text
  taken); OpenCode `opencode models`; Codex and Gemini CLI list none from their command line (their own default, or a
  model typed); an API provider its list endpoint when the vault notes its key (Anthropic `GET /v1/models`, OpenAI
  `GET /v1/models` without the embedding, audio and image models, Google `models` with `generateContent`, OpenRouter
  `api/v1/models`: free calls), else its priced models, each said `priced` or not (a run needs a price; OpenRouter
  reports each call's cost); the local agents every model Ollama has installed (`/api/tags`, the embedding models
  left out) with its size, parameters and quantization, then a few small ones it can pull (`PULLABLE`, *not
  installed: downloads N GB*; a run's *Check the connections* says `ollama pull`). A command's or an API's list is
  kept 10 minutes in `<factory>/cache/models-<provider>.json`; Ollama's and Claude Code's are read each time.
  Each model says what it is (`modelNamed`): its `family`, its `version` and a `label` (`claude-opus-5-5` → opus
  5.5, `qwen2.5-coder:3b` → qwen2.5-coder 3b, `gemini-2.5-pro` → gemini 2.5 pro), `alias` for an alias, whose
  version is `latest`. Claude Code lists each alias followed by every version of its family it accepts, the newest
  first, so a version is chosen as easily as the latest. The pickers say every line's kind (*Claude Code (agent) ·
  opus 5.5 (claude-opus-5-5)*, *Anthropic API (model) · …*, *Nuclear Developer (local) · qwen2.5-coder 3b*) and every
  group how it is paid (*Claude Code — agent, your Claude account*, *Anthropic API — model, pay per token with a
  key*, *Local — this machine, free*).
- **The memory guard** of a local model: this machine's memory (`machineMemory`: Linux `/proc/meminfo` `MemTotal` and
  `MemAvailable`; macOS `sysctl hw.memsize` and `vm_stat`'s free, inactive and speculative pages; Windows
  `Win32_OperatingSystem`), the model's need `memoryNeed` = its size on disk (else its parameters × the bytes per
  weight of its quantization: Q4 0.58, Q8 1.06, F16 2…) × 1.2 (the runner's buffers) + 1 GB (the context's cache at
  Ollama's default context), and its fit `fitOf`: **too-big** when the need passes the machine's memory less what
  the system and the editor keep (2 GB, or 15% of a bigger machine), since it can make the computer freeze or
  restart; **tight** when it passes the memory free now (it swaps unless other programs give memory back); else
  **fits**. A margin, not a measure; the GPU's own memory is not counted. The pickers draw too-big in red and ask
  before choosing it; `team create`, `team member add` and `team member update` answer `warnings` (each too-big or
  tight local member: `{member, model, needGb, totalGb, availableGb, fit, text}`); their MCP tools answer
  `needsUser` for a too-big one, applied only after the user's yes.
- The flags of `claude` were checked against Claude Code 2.1.327's `--help`, those of `opencode` against OpenCode
  2.2.7's. Codex and Gemini CLI are written from their documented headless modes, untested here (roadmap).
