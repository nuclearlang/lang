---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../02-architecture/api.md, ../02-architecture/responders.md]
---
# Connect a host

A host (the Builder, Atlas) gives the chat its project, its members and how each one answers. The AI set-up
starts the service at login; a host reads where it is and its token (only an editor's extension host, never a
page):

```sh
nuclear-chat connect --json     # {"url": "http://127.0.0.1:7880", "header": "X-Chat-Token", "token": "…"}
```

Every request below carries that header (`-H "X-Chat-Token: $TOKEN"`); a request with an `Origin` is refused.

## 1. Register the project
```sh
curl -s -X POST 127.0.0.1:7880/workspaces -H "X-Chat-Token: $TOKEN" -H 'content-type: application/json' -d '{
  "root": "/home/me/app", "host": "builder", "lang": "en", "gifs": "pack",
  "members": [{"id": "ada", "name": "Ada", "role": "architect", "team": "core",
               "personality": {"gifs": "sometimes", "on": ["failure"]},
               "responder": {"command": ["nuclear-builder", "member", "--team", "core", "--role", "architect"]}}],
  "teams": [{"id": "core", "name": "Core", "lead": "ada"}],
  "channels": [{"id": "core", "name": "core", "team": "core", "members": ["you", "ada"]}]}'
```
The answer's `id` names the workspace in every route. Register again on every start: the same folder is the same
workspace, and what the project kept (the channels' last read, the user's channels) stays.

A member can be a front for several agents (the general agent): its `responder` carries `choices`, each with the
command that answers as it, and `choice`/`model` the default; the user picks one per direct message (`PUT
channels/{ws}/dm-<member>/agent {"agent", "model"}`) and the chat runs that command
([responders.md](../02-architecture/responders.md)). The Builder's host file gives them from `nuclear-builder agents`.

## 2. Say, post, read
- The user says: `POST messages/{ws}/core {"text": "how is the run going?"}`. Ada, the tech lead, answers: her
  command runs with the conversation on stdin ([responders.md](../02-architecture/responders.md)).
- The host posts a run's station as a member: `POST messages/{ws}/core/post {"author": "ada", "text": "Design
  done", "thread": "<the run's message>", "moment": "success"}`.
- What happened is pushed: open `ws://127.0.0.1:7880/ws` with the header, send `{"subscribe": "chat.<ws>"}`, and
  each event arrives as `{"event": "chat.<ws>", "data": {…}}` (`message`, `typing`, `ask`, `done`, `action`…).
  After a reconnection, `GET events/{ws}?since=<the last n it saw>` gives what was missed.

## 3. Answer a member's question, take an action
- An event `ask` `{id, question, member}`: the user's answer is `POST members/{ws}/answers {"id", "answer"}`.
- An event `action`: a button clicked (`{button, message}`) or `/poc <what>`; what it does is the host's.

## Keep a GIF service's key
```sh
nuclear-chat gif-key tenor          # asked for, hidden; or: printf %s "$KEY" | nuclear-chat gif-key tenor
nuclear-chat gif-key tenor --remove
```
The workspace's `gifs` (`tenor`, `giphy`) turns the service on; the first search asks the user once whether the
search words may leave the machine.

## The hosts of the editors
VS Code's extension is the host of the Builder and of Nuclear Atlas
([the Builder in Nuclear Chat](../../../extensions/tools/nuclear-builder/docs/02-architecture/chat.md)): one WebSocket
per window with the token (`extensions/vscode/src/chatHost.ts`), the project registered from
`nuclear-builder chat-host --json` with each `face` read as a `data:` URL and the general agent's default from the
setting `nuclear.builder.chat` (when that agent is on the machine), and the pages (the Builder's dock and tab,
Atlas) mounting `ui/`'s bundle with a bridge whose frames the extension relays, adding the token.

