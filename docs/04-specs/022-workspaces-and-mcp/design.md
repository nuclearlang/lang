---
status: approved
owner: Julian Molina
updated: 2026-11-20
related: [requirements.md, tasks.md]
---
# Spec 022 — Design

## The marker: `.workspace/workspace.nuc`
```nuclear
// The workspace: the business project and the apps that form it (nuclear workspace …).
workspace(name = "citofony", description = "An intercom for buildings")
app(folder = "citofony-api", platform = "backend")
app(folder = "citofony-web", platform = "web")
app(folder = "citofony-client", platform = "mobile")
```
A folder is a workspace when it holds `.workspace/workspace.nuc`. Each app is a Synapsis project (its `config.nuc`)
in the named folder. The `.workspace/` folder can hold more later (the workspace's specs or teams); nothing else is
in it today.

## `nuclear workspace` (tools/cli; the writer of the marker is one module, used by every command)
```
nuclear workspace new <path> [--name <n>] [--description <d>] [--json]
nuclear workspace add <app> --platform mobile|web|backend [--dialect <d>] [--workspace <dir>] [--json]
nuclear workspace remove <app> [--delete] [--workspace <dir>] [--json]
nuclear workspace rename <app> <new> | rename --workspace-name <n> [--workspace <dir>] [--json]
nuclear workspace edit [--name <n>] [--description <d>] [--workspace <dir>] [--json]
nuclear workspace list [--json]                   # the apps of the workspace of the current folder (or --workspace)
nuclear workspace show [--json]                   # {root, name, description, apps:[{name, folder, platform, dialect, exists}]}
nuclear workspace find [--json]                   # the workspace that holds the current folder, or null
```
`--workspace` absent: the workspace that holds the current folder. `--json` gives `show`'s object (or `{error}`).
Deleting an app's folder only with `--delete`.

## The editor
- Recent workspaces: `globalState` `nuclear.workspaces.recent` (root, name, last opened), never `workspaceState`.
- The open workspace: the one holding VS Code's folder, else the last one opened (asked when it is not that folder).
- The strip's project slots are the workspace's apps (`nuclear workspace show --json`), refreshed when the marker changes.
- Empty: a panel that says why and lists recent workspaces, *Open a workspace…*, *Create a workspace*.
- Welcome: the three steps of requirement 5, each with *Do it with me by chat* (Atlas with a first message).

## The MCP server (tools/mcp, Nuclear)
- Tools: `workspace_create`, `workspace_show`, `workspace_edit`,
  `workspace_delete`, `app_add`, `app_rename`, `app_remove`, `spec_create`, `spec_list`, `spec_show`, `spec_edit`,
  `team_create`, `team_edit`, `team_delete`, `member_add`, `member_edit`, `member_remove`, `team_list`, `team_show`,
  `skills_set` — each a thin call of `nuclear workspace …` or `nuclear-builder …` with `--json`.
- Confirmation: every tool that changes something first asks the user with MCP elicitation (`ctx.elicit`: what will
  change, yes/no). A client without elicitation: the tool answers a preview with a `confirm` token (valid for that
  exact change, a few minutes) and changes nothing; the agent shows it to the user and calls again with the token.
- `workspace_delete` never deletes app folders unless asked (`deleteFolders = true`, said in the preview).
