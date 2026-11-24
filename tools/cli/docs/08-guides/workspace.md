---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [tools/cli/src/framework/workspace.rs, tools/cli/docs/08-guides/commands.md, docs/04-specs/022-workspaces-and-mcp/design.md]
---
# Workspaces

A **workspace** is a folder that organizes one business project and the apps that form it: a mobile app, a web app,
a backend or several of each. Start every piece of work from one: the editor, the MCP server and the agents find the
apps through it instead of searching a folder full of projects in other languages.

```
citofony/                      the workspace
  .workspace/workspace.nuc     the marker: the workspace and its apps
  citofony_api/                a backend (a Synapsis project: its config.nuc)
  citofony_web/                a web app
  citofony_client/             a mobile app
```

A folder is a workspace when it holds `.workspace/workspace.nuc`. The marker is Nuclear, written by the commands
below (edit it by hand only to reword its comments):

```nuclear
// The workspace: the business project and the apps that form it (nuclear workspace ...).
workspace(name = "citofony", description = "An intercom for buildings")
app(folder = "citofony_api", platform = "backend")
app(folder = "citofony_web", platform = "web")
```

## Make one and add its apps

```sh
nuclear workspace new citofony --description "An intercom for buildings"
cd citofony
nuclear workspace add citofony_api --platform backend            # nuclear new, in the workspace, then the marker
nuclear workspace add citofony_web --platform web --dialect react
nuclear workspace list
```

`add` is `nuclear new`: the same files, the same default dialect of each platform (`backend`: fastapi, `web`:
react, `mobile`: flutter) and the same options (`--org`, `--websocket`, `--token`). `nuclear new <name>` run in any
folder inside a workspace does the same: the project is made in the workspace's folder, not in the current one, and
written into the marker. An app's name is a project's name: letters, digits and `_` (`citofony-api` becomes
`citofony_api`), so it is always a plain folder of the workspace.

## Where its apps run

Every app is also in the registry of projects of the machine (`nuclear projects [--json]`, MCP `projects_list`),
with its own development port, chosen once and kept (the dialect's when no other project has it, else the next
one): `nuclear run` serves there. A web or mobile app built in `development` without an `API_URL` calls the
workspace's first backend at its address (`http://127.0.0.1:<port>/`), and a backend run in `development` lets every
address of the registry, and any port of `localhost`, `127.0.0.1` and `[::1]`, call it from a browser (CORS): a
web app or a Flutter app run on Chrome reaches its backend without listing its origin. In production only the
backend's `origins` apply (the backend's reference, §2.8).

## Change it

| Command | What it does |
|---|---|
| `workspace rename <app> <new>` | renames the app's folder and its entry; the project's `app(name)` in its `config.nuc` stays unless `--project-name` (a project without `app(name)` takes its folder's name). Run `nuclear install` in it again: a virtual environment keeps the path it was made in |
| `workspace rename --workspace-name <n>`, `workspace edit [--name <n>] [--description <d>]` | the workspace's name and description |
| `workspace remove <app>` | out of the marker only; its folder stays. `--delete` deletes the folder too, never a folder outside the workspace |
| `workspace show`, `workspace find` | the workspace and its apps; the workspace that holds the current folder |

Every command takes `--workspace <dir>` (default: the workspace that holds the current folder, found by walking up)
and `--json`, which prints one object, the same for every command:

```json
{"root": "/home/me/citofony", "name": "citofony", "description": "An intercom for buildings",
 "apps": [{"name": "citofony_api", "folder": "citofony_api", "platform": "backend", "dialect": "fastapi", "exists": true}]}
```

`name` and `dialect` come from each app's `config.nuc` (`dialect` is `null` when its folder has no project); `find
--json` prints `null` outside a workspace; a refusal is `{"error": "..."}` with exit code 1.

## Check it

- `nuclear check` in the workspace's folder (not inside an app) checks every app in turn and fails when one fails;
  `--json` is one app's (run it in the app, or `--project <folder>`).
- `nuclear doctor` there also says the workspace's apps and any app whose folder is missing.
