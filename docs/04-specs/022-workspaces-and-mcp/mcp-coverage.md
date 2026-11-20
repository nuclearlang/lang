---
status: approved
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, design.md, ../../../tools/mcp/docs/08-guides/mcp.md]
---
# Spec 022 — What an agent can do through the MCP server

Requirement 9. Each row is one tool of the platform: what an agent does through `nuclear-mcp` today, what it cannot
and where that is done instead (a command or the editor), and the priority of offering it. A row is updated in the
change that adds the tool. **By design** marks what never becomes a tool (a secret, money, the machine, the user's
name). Changes go through the user's confirmation (elicitation, or a preview and its token).

| Tool of the platform | Through the MCP server | Not through it (where) | Priority |
|---|---|---|---|
| Workspaces (`nuclear workspace`) | `workspace_create`, `workspace_show`, `workspace_edit`, `workspace_delete`; `app_add`, `app_rename`, `app_remove` | the workspace of a folder (`workspace find`), its apps alone (`workspace list`: `workspace_show` has them); `rename --project-name`; the editor's recent workspaces | low |
| Projects (`nuclear new`, `build`, `install`, `test`, `check`, `analyze`, `make`, `gen`, `migrate`, `add`, `remove`, `explain`) | `nuclear_project`, `generate_*`, `project_inspect`, `nuclear_check` | `nuclear fix` (the exact fixes), `nuclear fmt` of files (`nuclear_fmt` takes a piece), `repair`, `clean` | medium (`fix`) |
| Running an app (`nuclear run`, `device`, `terminal-device`, `watch`, `code`) | its log after a run (`project_run_log`) | start, stop or look at a run or a device: a terminal or the editor's ▷ Run / ▭ Device | medium |
| The language (`help`, `spec`, `defs`, `build` of a piece) | `nuclear_start`, `nuclear_doc`, `nuclear_help`, `nuclear_brief`, `nuclear_defs`, `nuclear_build` | `defs search`, `defs list`; `dialect list|check`, `kind new` (a dialect's or a kind's author) | low |
| Contracts (`nuclear contracts list|update`) | — | the contracts a project declares and their update: the command, the editor's HTTP Connections | medium |
| HTTP Connections (editor) | — | the endpoints' tree, sending a request and reading its answer: the editor | medium |
| Environments (`nuclear env`, editor) | `nuclear_env`: `list`, `envs`, `set`, `unset`, `use` | a secret's value: `nuclear env set NAME --secret` in a terminal (**by design**) | — |
| Nuclear Monitor (`nuclear monitor`, editor) | `project_monitor`, `graph_monitor` | a run with `--monitor` (above) | low |
| Specs (Nuclear Builder) | `spec_create`, `spec_list`, `spec_show`, `spec_edit` | move, migrate, delete a spec; a draft's accept or discard: `nuclear-builder spec move|migrate|delete|accept|discard` or the Builder's page | low |
| Runs of the factory (Nuclear Builder) | — | start, resume, retry, stop a run, answer its gates, its file and journal, QA's checks: `nuclear-builder run|retry|restart|runs|checks …`, the Builder's page; the factory's own agents get them from `nuclear-builder mcp` | high |
| Teams (Nuclear Builder's company screen) | `team_list`, `team_show`, `team_create`, `team_edit`, `team_delete`, `member_add`, `member_edit`, `member_remove`, `skills_set` | `team suggest|name-suggest|runnable|duplicate|default|export|import|logo|roster|temperaments`; own skills `skills list|show|clone|create|update|delete`: the commands, the company screen | medium |
| The line, CI, connections (Nuclear Builder) | — | `nuclear-builder line show|set`, `export github|gitlab|bitbucket`, `connections`: the commands, the Builder's settings | low |
| Reports (Nuclear Builder) | — | the bill and the views: `nuclear-builder metrics … --json`, the Reports page | medium |
| Agents and models (Nuclear Builder) | — | `nuclear-builder agents --json`, `models --json` (which a team's member can be worked by) | medium |
| Vault (API keys) | — | `nuclear-builder vault set|remove|list`, the settings page; a key never passes through an agent (**by design**; `vault list`: low) | — |
| Nuclear Atlas and Nuclear Chat (editor) | — | conversations, channels, a member's answer: the editor's chat (`Ctrl+Alt+A`); the agent is the chat's member, not its client | low |
| The Smart Graph (`nuclear-graph`) | `graph_strategy`, `graph_answer`, `graph_search`, `graph_card`, `graph_prompt`, `graph_remember` | `knowledge build|check`, `ingest`, `connect`, `web-key`: the platform's maintainers and the set-up (**by design**: the machine's) | — |
| The internet | `api_inspect`, `web_search`, `web_read` | a page of this machine or the local network (**by design**) | — |
| Settings, set-up, updates (`nuclear-builder setup`, `nuclear update`, the settings page) | — | the machine's and the editor's (**by design**) | — |
| Local developer (`developer_*`) | on standby (ADR-platform-0013): no tool | — | — |
