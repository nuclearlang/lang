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
app(folder = "citofony_api", platform = "backend")
app(folder = "citofony_web", platform = "web")
app(folder = "citofony_client", platform = "mobile")
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

As built (the CLI, 2026-11-20):
- An app's folder is the name `nuclear new` gives the project: letters, digits and `_` (`add citofony-api` makes
  `citofony_api`), so the folders of requirement 1 are written with `_`. A marker written by hand may name any plain
  folder (one name, no `/`, no `..`, not hidden); `workspace(...)` takes only `name` and `description`, `app(...)`
  only `folder` and `platform`; anything else is N0303 with its line.
- `<app>` in the commands is the app's folder. In the JSON, `name` is the project's name (`app(name)` of its
  `config.nuc`, else its folder's) and `dialect` its `config.nuc`'s (`null` without one); `exists`: the folder is there.
- Every command with `--json` prints `show`'s object (`list` too); `find` outside a workspace prints `null` (exit 0);
  a refusal prints `{"error": "..."}` (exit 1).
- `add` passes `nuclear new`'s own options on (`--org`, `--websocket`, `--token`). `new` refuses a folder inside
  another workspace and a project's folder.
- `rename <app> <new>` without `--project-name` leaves `config.nuc` as it is.
- `nuclear check` in a workspace's folder (not inside an app) checks every app; with `--json` it asks to run it in
  one app. `nuclear doctor` there adds a Workspace line (its apps, a missing folder).
- The atlas topic `workspace` is the CLI's guide (`tools/cli/docs/08-guides/workspace.md`); the editor's workspace
  panel is the topic `editor-workspace`.

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
