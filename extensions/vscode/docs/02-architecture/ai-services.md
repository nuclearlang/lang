---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [workspace.md, ../../../tools/nuclear-builder/AGENTS.md, ../../../tools/nuclear-atlas/AGENTS.md, ../../../../installer/docs/08-guides/ai-setup.md]
---
# The AI services in the editor: set-up, settings, connections, notifications

What Nuclear Builder and Nuclear Atlas need around them. The services themselves (the Smart Graph, the Nuclear Developer) and
their models are other projects; what a user does is in
[Set up the AI services](../../../../installer/docs/08-guides/ai-setup.md).

## The set-up (`setupPanel.ts`, `aiMachine.ts`; ADR-installer-0002)

The set-up is `nuclear-builder setup`, written in Nuclear
([`../../../tools/nuclear-builder/setup.nuc`](../../../tools/nuclear-builder/AGENTS.md), its data `setup.json`). The
extension runs it as a process, one call per action, and keeps no process of it alive:

| The extension asks | `nuclear-builder setup ...` | It gives |
|---|---|---|
| the page's state | `--plan --json` | this machine, the profiles with `fit` and `note`, the suggested one, the machine's choice, the AI root, the requirements of both modes |
| the steps of a profile | `--events --profile <id> --from <step>` | one JSON line per event: `steps`, `step` (running with a line, done, failed), `done`; the page's messages as they are |
| whether the services start at login | `--status --json` | `atLogin`, what runs, the missing models |
| the models chosen in the settings | `--set CODER_MODEL=... ASSISTANT_MODEL=... NUCLEAR_GRAPH_EMBED=...` | written to `ai.env` |
| a service again | `--restart graph\|developer` | exit 0 when the system's manager restarted it |

- `aiMachine.ts` is what the extension reads itself, with no process: `machineFile()` / `readMachine()`
  (`~/.config/nuclearlang/ai.env`: Nuclear Builder's `defaultConfig` and `aiSettings` take their default models from
  it; a model set in the settings wins), `urls()` (the ports chosen there) and `builder(args)`, which runs the AI
  archive's `<installation>/ai/bin/nuclear-builder` (it runs before the set-up linked it onto the PATH), else the
  PATH's.
- The steps, in order, each can run again: the graph and the MCP server (the archive's launchers linked onto the
  PATH; from source `uv tool install`, editable), the Developer (in the archive; from source `nuclear install` and
  the `nuclear-developer` launcher), the models (Ollama's `/api/pull`), the ports (each service keeps its port when
  it already runs there, else the first one from 7878 / 7879 upward it can listen on, written to `ai.env`;
  ADR-installer-0003 §5) and the graph's service, the knowledge base (`connect` twice, `ingest`), the Developer's
  service.
- `setupPanel.ts` is the page (*Nuclear: Set Up the AI Services*): four steps drawn from the plan. It polls `check`
  every three seconds on the requirements step (a new plan). An installer runs in a terminal (`createTerminal` +
  `sendText`), never hidden. `SetupPanel.offer` asks once on a machine with no machine file. Without the AI archive
  the page says to run the installer again.

## Settings and integrations (`settingsPanel.ts`, `aiSettings.ts`, `localModels.ts`; ADR-platform-0003)

The tool `settings` of the strip (`Ctrl+Alt+S`).

- `aiSettings()` reads `nuclear.ai.*` (`contributes.configuration` of `package.json`). `machineConfig()` is passed
  to `readConfig(root, platform, machine)`: defaults < settings < the project's `.nuclear/builder.json`, which is
  shared with CI. `serviceEnv()` is the environment the graph and the Developer are started with (`CODER_MODEL`,
  `ASSISTANT_MODEL`, `OLLAMA_URL`, `NUCLEAR_GRAPH_EMBED`, the ports).
- The page:
  - **services**: their health urls; *Start* / *Restart* go through the system's services first, else spawn
    `<graphCommand> serve` / `nuclear-developer` (owned processes, stopped on deactivate);
  - **models**: Ollama's `/api/tags`; `billionsOf` (`localModels.ts`) counts a model's size from what Ollama
    reports, with the effective size of an `eNb` tag, against `MAX_BILLIONS` = 3.5 (the rule of the local models:
    at most the 3B class); *Pull* runs as a task;
  - **MCP**: registers `nuclear.ai.mcpCommand` (default `nuclear-mcp`, the server of
    [`tools/mcp/`](../../../../tools/mcp/AGENTS.md), started with no argument) in Claude Code
    (`claude mcp get|add --scope user`), Codex (`codex mcp list|add`), Cursor (`~/.cursor/mcp.json` merged) and
    OpenCode;
  - **connections**: `nuclear.ai.graphCommand` (default `nuclear-graph`)
    `requests|allow|deny|revoke|connect mcp`, Jira in the secret storage
    (`jiraAuth`), `gh auth status`;
  - **pipeline**: Claude's model and the retry policy.

## Checked connections (`connections.ts`; ADR-platform-0003)

Every external connection of the extension: the Nuclear Developer, the Smart Graph, Ollama and the local models,
and each integration enabled in the settings (Claude Code, Codex, OpenCode, GitHub, Jira).

- `checkAll`: all of them. `checkForChat`: what a chat question needs. A Nuclear Builder run checks its own
  (`preflight` of the engine).
- `watchConnections`: every `nuclear.ai.checkEveryMinutes`; a connection that stops answering, or answers again, is
  a notice of kind `settings`.

## Notifications (`notifications.ts`; ADR-platform-0003)

What the local agents did while the user was elsewhere: a chat answered, a Nuclear Builder run passed, failed or
needs the user.

- `notices` is one store: `add` (a toast with *Open*, unless that tool is on screen), `watch(tool, visible)` from
  the panels' `onDidChangeViewState`, `unread(tool)`, `open` (set by the workspace: `openNotice` → the tool on that
  run or session). The tools that have notices: `agent`, `builder`, `settings`.
- The workspace shows them: the badge on the Nuclear icon of the activity bar, a count on the tool's tab, the list
  in the tool's pane.
- Nuclear Builder's engines (`engines` in `tools/nuclear-builder/src/panel.ts`) and Nuclear Atlas's jobs (`jobs` in
  `tools/nuclear-atlas/src/panel.ts`) are module-level: a page is only a view, so closing it or switching tools
  leaves the work running.
