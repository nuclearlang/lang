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
  Nuclear Builder offers no Nuclear Developer; the MCP server registers no `developer_*` tool; the editors show no
  profile, Ollama step or Developer status.
- **Local AI is OpenCode on the user's Ollama** (decided 2026-11-23, while the Nuclear Developer improves): Nuclear
  Builder's kind `local` has one provider offered, `opencode-local`, OpenCode on the models Ollama has installed
  (`ollama/<tag>`, OpenCode finds them by itself), free, chosen in the pickers as a paid provider is. Choosing
  *Local* lists only them; OpenCode as an agent lists none of them. Nothing installs Ollama or pulls a model: both are
  the user's.
- **Nuclear Atlas** is answered by an external provider or agent the user picks, over the Smart Graph, as Nuclear
  Chat's members are.
- **Existing installations**: an update takes away everything local NuclearLang put there: the Developer's service,
  the models NuclearLang downloaded, and Ollama when NuclearLang installed it (what was on the machine before stays,
  ADR-installer-0005). A team member or a setting that named the local kind or a local model is converted on read
  to the default external choice, the old file kept as `.bak`, and the user is told.
- **The Smart Graph is not touched**: it runs its own embeddings model (no Ollama, ADR-graph-0003), in the profile
  `remote` as before.
- The Nuclear code stays behind the switch (Nuclear Builder's set-up, engine and chat, the MCP server's
  `developer_*` tools, the Nuclear Developer, which ships inert in the AI archive), and its tests still run with the
  switch turned on in the test (`localOn`). The editors' local-model UI (the profile cards, the local model pickers,
  the Developer's and Ollama's status and settings, `extensions/vscode/src/localModels.ts`) was removed: it is in git
  at commit `ac61a04`, to be brought back and tested if the switch is turned on again, a decision of the user.

## Consequences
Lighter installs (no GB of models, no Ollama), one way of working (paid or subscribed providers), fewer services to
keep alive. The knowledge base says the local models are on standby.

## The contract (what the commands answer while the switch is off)
- `nuclear-builder setup --plan --json` carries `"localModels": false`, `"suggested": "remote"` and only the profile
  `remote` in `profiles`; `requirements.local` is the same list as `requirements.remote` (no Ollama).
- The profile `remote` runs the Smart Graph **and Nuclear Chat** (the Builder's and Atlas's workplace): its steps are
  `graph`, `clients`, `graph-model`, `graph-service`, `knowledge`, `chat-service`; a machine that still has something
  local of NuclearLang gets a first step `standby` (its title: "Take away the local models (on standby)"), which
  removes the Developer's service and launcher, the models NuclearLang pulled, Ollama when NuclearLang installed it,
  writes `ai.env` as `remote`, and says the GB freed.
- `setup --profile lite|medium|hard` (also `--events`) is refused: exit 2, "on standby (ADR-platform-0013)". The
  installers ask nothing and always run `setup --profile remote --yes`.
- `agents --json`, `models --json` and `team screen` list no Nuclear Developer; the kind `local` is `opencode-local`
  only, its models Ollama's installed ones (`team screen` carries `"localModels": false`). `models --provider nuclear-developer` answers no models and a `why`.
- The default external choice (a member with no who-works, a converted one, the chat's general agent): the first
  agent whose command is on the PATH, in the order Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Grok Build; else
  the first API provider whose key the vault notes (Anthropic, OpenAI, Google, OpenRouter) with a priced model; else
  none, and the command says a provider must be chosen (a converted member is then set to Claude Code with that
  warning). A team's converted members are told as `warnings` (a list of texts): in the team of `team show`,
  in each entry of `team list`, in each shown team of `team screen` and at its top (every team's, as
  `<team name>: <warning>`); the team file is rewritten once, its old version kept as `<id>.json.bak`. `team create`
  and `team member add|update` refuse the provider `nuclear-developer`.
- `chat-host --json`: Atlas's `responder.choice` is the default external choice (`""` with `responder.why` when there
  is none); its `choices` hold no local agent.
