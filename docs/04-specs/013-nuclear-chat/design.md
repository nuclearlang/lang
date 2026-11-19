---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, tasks.md, ../011-software-factory/design.md]
---
# Spec 013: Nuclear Chat — Design

## The parts

| Part | Where | What |
|---|---|---|
| The service | `nuclear-chat/` (a Synapsis `backend` project, dialect `fastapi`, made with `nuclear new`/`gen`) | channels, messages, threads, mentions, reactions, the history, the GIFs, the responders; its controllers over HTTP and a WebSocket connection declared in its config (spec 014), the same controllers; `127.0.0.1`, a token on every route |
| The pack | `nuclear-chat/pack/` | the GIFs made for the project and `pack.json` (their tags) |
| The UI | `nuclear-chat/ui/` (a Synapsis `web` project, dialect `react`, built in the embedded mode of spec 014) | Slack's shape, mounted in a host's page; talks to the service through the host's bridge |
| A host | the Builder (`extensions/tools/nuclear-builder`), Nuclear Atlas (`extensions/tools/nuclear-atlas`) | starts or finds the service, gives the members and their responders, opens channels, posts as a member, takes the buttons' actions |

The chat knows nothing of the factory: what a member is, how they answer and what a button does are the host's.
The JSON messages below are the service's events and requests; the real routes are
`nuclear-chat/docs/02-architecture/api.md`.

## On disk (in the project)

```
.nuclear/chat/
  channels.json            [{ "id": "general", "name": "general", "topic": "…", "kind": "channel|dm", "members": ["…"], "lastRead": 0 }]
  general.jsonl            one message per line, appended
  dm-<member>.jsonl
```

A message: `{ "id", "at", "author": "<member id>|you|system", "text", "thread": "<message id>"?, "gif": { "src",
"title", "source": "pack|tenor|giphy" }?, "reactions": { "👍": ["you"] }, "buttons": [{ "id", "label", "style" }]?,
"links": { "spec"?, "run"? }, "costUsd"? }`. An edit or a reaction is a new line that names the message
(`{ "edit": "<id>", … }`); reading folds them. A line cut by a crash is skipped.

## The members

Given by the host in the host file (below): `{ "id", "name", "role", "team", "avatar", "profile": { "bio",
"hrNote", "lang" }, "personality": { "gifs": "never|sometimes|often", "on": ["failure", "success", "question"] },
"responder": { "command": ["…"], "paid": true|false } }`. `sometimes` is one GIF in five of the moments it names,
`often` one in two; the choice is random with the message id as seed (a history read again shows the same).

## The responder

How a member answers, run by the chat once per answer: the member's `responder.command` with `--events`, the
conversation on stdin as one JSON line `{ "member", "channel", "thread", "messages": [last 40], "said": "…",
"lang" }`; out, JSON lines: `{ "type": "typing" }`, `{ "type": "text", "text" }`, `{ "type": "tool", … }`,
`{ "type": "ask", "id", "kind": "spending", "question", … }` (relayed to the user, the answer written back on
stdin), `{ "type": "done", "costUsd", "error"? }`. The Builder's responder is `nuclear-builder member --team <id>
--role <role> --events` (the role's provider through the factory's adapters, the factory's tools, the money's two
confirmations); Atlas's is the same command for the general agent (`--role chat`).

## The service's messages

The service runs once per machine (like the Nuclear Developer); a host registers a project with its host file. The host file (written by the host before it starts): `{ "host": "builder|atlas", "members": [...],
"channels": [{ "id", "name", "topic", "members" }], "lang": "en|es" }`; `{ "type": "host", "file" }` on stdin
reloads it.

In (the page or the host): `{ "type": "open", "channel" }`, `{ "type": "say", "channel", "text", "thread"? }`,
`{ "type": "react", "message", "emoji" }`, `{ "type": "gif", "channel", "thread"?, "gif" }`, `{ "type": "gif.search",
"q" }`, `{ "type": "answer", "id", "answer" }`, `{ "type": "channel.new", "name", "topic", "members" }`, and the host's
`{ "type": "post", "channel", "thread"?, "author", "text", "buttons"?, "links"?, "moment"?: "failure|success|question"
}` (a member's GIF may follow by their personality), `{ "type": "update", "message", "text"?, "buttons"? }`.

Out: `{ "type": "channels", "channels": [...with unread] }`, `{ "type": "history", "channel", "messages" }`,
`{ "type": "message", "channel", "message" }`, `{ "type": "typing", "channel", "member" }`, `{ "type": "ask", … }`,
`{ "type": "gifs", "q", "results" }`, `{ "type": "action", "message", "button" }` (a button clicked: the host's),
`{ "type": "error", "error" }`.

A message that mentions a member (`@name`, `@role`) or is in their direct messages is answered by that member's
responder; a message to a team (its channel, `@<team>`, a run's thread) by the team's tech lead, the host file's
`teams: [{ "id", "name", "lead": "<member id>" }]`. `/poc <what>` is an `action` for the host (the
Builder runs the proof of concept in `.nuclear/poc/<id>/`).

## The GIFs

`pack/pack.json`: `[{ "id", "file", "title", "tags": ["failure", "success", "question", "thinking", "coffee", …] }]`,
at least 30, made for the project (animated SVG drawn in the platform's palette, no third-party image). Search:
the pack by tag and title; then, when on, Tenor (`tenor.googleapis.com/v2/search`) or Giphy
(`api.giphy.com/v1/gifs/search`) with the key from the system's keyring (service `nuclear-chat`, `nuclear-chat
gif-key tenor|giphy`); the first online search of a project asks once, and the answer is kept. The settings:
`nuclear.chat.gifs` (`pack|tenor|giphy`), in the onboarding and *Settings and integrations*.

A member's answer may ask for a GIF: the responder is given the pack's tags (`gifTags`) when the member's
personality sends GIFs, and ends its `done` with `"gif": "<tag>"` (the member's prompt: one last line `gif: <tag>`,
never shown); the service picks one of that tag, capped by the personality (one in two for `sometimes`, nine in ten
for `often`; more when the user just sent a GIF), and posts it after the answer
([responders.md](../../../nuclear-chat/docs/02-architecture/responders.md)).

## The UI

The `web` project built embedded (spec 014): `mount(el, bridge)`, `bridge.send(msg)` and `bridge.onMessage(cb)` (the page passes them to its host,
which passes them to the process). Slack's layout: the sidebar (channels, direct messages, unread counts; it
folds when the host has little room), the channel (messages grouped by author and minute, markdown and code,
GIFs, reactions, a thread's count and last reply), the thread beside it, the composer (`@`, `#`, `/` completion,
the GIF picker, Enter sends, Shift+Enter a new line). The Builder mounts it in the dock under the diagram and as
a full tab (*Open the chat*); Atlas as its whole page. Texts in English and Spanish from the host.

## Commands

`nuclear-chat serve …`, `nuclear-chat channels --root <p> --json`, `nuclear-chat history <channel> --root <p>
--json`, `nuclear-chat search <words> --root <p> --json`, `nuclear-chat gif-key tenor|giphy` (to the keyring),
`nuclear-chat pack --json`. Installed by `installer/install.sh` like `nuclear-builder`.
