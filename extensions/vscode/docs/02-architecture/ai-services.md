---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [workspace.md, ../../../tools/nuclear-builder/AGENTS.md, ../../../tools/nuclear-ai-chat/AGENTS.md, ../../../../installer/docs/08-guides/ai-setup.md]
---
# The AI services in the editor: set-up, settings, connections, notifications

What the Loop and the chat need around them. The services themselves (the Smart Graph, the Nuclear Developer) and
their models are other projects; what a user does is in
[Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md).

## The set-up (`aiSetup.ts`, `aiSetup.json`, `setupPanel.ts`; ADR-installer-0002)

- `aiSetup.ts` has no editor in it. Its two fronts are `nuclear-loop setup` (`loopCli.ts`) and the wizard. It reads
  the machine (`hardware`), says how a profile sits on it (`fit`, `recommend`), finds what is installed
  (`requirements`, `status`) and gives the ordered `steps(profile, root)`:
  1. the graph's tool (`uv tool install`, editable when the folder is a git checkout);
  2. the Developer (`dragonfly install` with a Python 3.12+ that uv finds or brings, and the `nuclear-developer`
     launcher);
  3. the models (Ollama's `/api/pull`, with its progress);
  4. the graph's service;
  5. the knowledge base (`connect` twice, `ingest`);
  6. the Developer's service.

  Every step can run again.
- `aiSetup.json` is the data: the requirements (their command, their installer per system, their page) and the
  profiles (models, download, memory, what works, what does not). Changing a profile is changing this file and
  measuring it (`nuclear-agents/nuclear_developer/eval/run.py`); `test/setup.test.ts` holds its shape and holds the
  user's guide to it.
- The machine's choice is `machineFile()` (`~/.config/nuclearlang/ai.env`). `readMachine` gives the Loop
  (`defaultConfig`) and the editor (`aiSettings`) their default models; a model set in the editor's settings wins,
  and is written there when the settings page restarts a service.
- `serviceFiles(platform)` are the files that start the services at login (systemd user units, launch agents, a
  Startup script). `restartService` goes through the system's manager. `remove()` is `nuclear-loop setup --remove`.
- The services' folder is `aiRoot()`: `<installation>/ai`, or `NUCLEAR_AI_ROOT`.
  Under it the two services keep the folders of the tree (`nuclear-graph-storage/`, with its knowledge base in `data/`,
  and `nuclear-agents/nuclear_developer/`), so the Developer's relative `dependencies(nuclear_graph = ...)` holds in an
  installation too. From source both are links to the tree; the graph is then installed editable.
- `setupPanel.ts` is the page (*Nuclear: Set Up the AI Services*): four steps drawn from one state message. It
  polls `check` every three seconds on the requirements step. An installer runs in a terminal (`createTerminal` +
  `sendText`), never hidden. `SetupPanel.offer` asks once on a machine with no machine file.

## Settings and integrations (`settingsPanel.ts`, `aiSettings.ts`, `localModels.ts`; ADR-platform-0003)

The tool `settings` of the strip (`Ctrl+Alt+S`).

- `aiSettings()` reads `nuclear.ai.*` (`contributes.configuration` of `package.json`). `machineConfig()` is passed
  to `readConfig(root, platform, machine)`: defaults < settings < the project's `.nuclear/loop.json`, which is
  shared with CI. `serviceEnv()` is the environment the graph and the Developer are started with (`CODER_MODEL`,
  `ASSISTANT_MODEL`, `OLLAMA_URL`, `NUCLEAR_GRAPH_EMBED`, the ports).
- The page:
  - **services**: their health urls; *Start* / *Restart* go through the system's services first, else spawn
    `nuclear-graph serve` / `nuclear-developer` (owned processes, stopped on deactivate);
  - **models**: Ollama's `/api/tags`; `billionsOf` (`localModels.ts`) counts a model's size from what Ollama
    reports, with the effective size of an `eNb` tag, against `MAX_BILLIONS` = 3.5 (the rule of the local models:
    at most the 3B class); *Pull* runs as a task;
  - **MCP**: `claude mcp get|add --scope user`, `codex mcp list|add`, `~/.cursor/mcp.json` merged;
  - **connections**: `nuclear-graph requests|allow|deny|revoke|connect mcp`, Jira in the secret storage
    (`jiraAuth`), `gh auth status`;
  - **pipeline**: Claude's model and the retry policy.

## Checked connections (`connections.ts`; ADR-platform-0003)

Every external connection of the extension: the Nuclear Developer, the Smart Graph, Ollama and the local models,
and each integration enabled in the settings (Claude Code, Codex, OpenCode, GitHub, Jira).

- `checkAll`: all of them. `checkForChat`: what a chat question needs. A Loop run checks its own (`preflight` of
  the engine).
- `watchConnections`: every `nuclear.ai.checkEveryMinutes`; a connection that stops answering, or answers again, is
  a notice of kind `settings`.

## Notifications (`notifications.ts`; ADR-platform-0003)

What the local agents did while the user was elsewhere: a chat answered, a Loop run passed, failed or needs the
user.

- `notices` is one store: `add` (a toast with *Open*, unless that tool is on screen), `watch(tool, visible)` from
  the panels' `onDidChangeViewState`, `unread(tool)`, `open` (set by the workspace: `openNotice` → the tool on that
  run or session). The tools that have notices: `agent`, `loop`, `settings`.
- The workspace shows them: the badge on the Nuclear icon of the activity bar, a count on the tool's tab, the list
  in the tool's pane.
- The Loop's engines (`engines` in `loopPanel.ts`) and the chat's jobs (`jobs` in `chatPanel.ts`) are module-level:
  a page is only a view, so closing it or switching tools leaves the work running.
