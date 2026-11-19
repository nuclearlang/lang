---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [api.md, responders.md, ui.md, ../03-adr/0001-a-synapsis-service-and-a-system-library.md]
---
# Overview

```
host (Builder, Atlas) ──HTTP──▶ nuclear_chat (Synapsis backend, 127.0.0.1)
        ▲                          │ components: workspaces · channels · messages · members · gifs · events
        │ /ws (events pushed),      │
        │ X-Chat-Token on all       ├─▶ system/ (nuclear_chat_system): ChatFiles · Processes · Keyring · ChatPack
        │                          │        └─▶ <project>/.nuclear/chat/*   a member's responder command
        └──────────────────────────┤        └─▶ the keyring (service nuclear-chat)   pack/
                                   └─▶ Tenor / Giphy (HTTP repositories, only with a key and the project's yes)
```

## The parts
| Part | Folder | Built with |
|---|---|---|
| The service | `nuclear_chat/` | Synapsis `backend`, dialect `fastapi`; `nuclear new`, `nuclear make`, `nuclear gen resource` (Tenor, Giphy) |
| The system library | `system/` | Nuclear, `python` dialect, package `nuclear_chat_system`; typed for the service by `nuclear_chat/defs/` |
| The pack | `pack/` | 36 animated SVG drawn for the project, `pack.json` (`id`, `file`, `title`, `tags`) |
| The UI | `ui/` | Synapsis `web`, dialect `react`, built embedded (`dist-embed/embed.js`); the service's contract generates its repositories: [ui.md](ui.md) |

## The components (`nuclear_chat/components/`)
Each one is used by the others only through its appcomponent (`nuclear check` enforces it). Who depends on whom:
`workspaces` ← `events`, `gifs` ← `messages` ← `channels`, `members`. The members answer by listening to the
events (`listener MemberAnswers` on `chat.event`), so `messages` never depends on `members`.

| Component | Holds |
|---|---|
| `workspaces` | `WorkspaceRegistry`: the registered projects (in memory: a host registers on start), their channels kept in `channels.json`; `Workspace.chatFile(name)` |
| `channels` | `ListChannels` (unread counts), `CreateChannel` (`Release Plan` → `release-plan`), `ReadChannel`, `ChooseAgent` (a direct message's agent) |
| `messages` | `MessageStore`: append, read, fold (edits, reactions, threads), locate a message, unread, search; the use cases of saying, posting, editing, reacting, GIFs, buttons |
| `members` | `Routing` (who answers), `Responders` (a run per answer, its asks), `AnswerMessage`, `AnswerQuestion` |
| `gifs` | `GifChoice` (the pack, the personality's draw, the one question), `TenorRepository`, `GiphyRepository`, `SearchGifs` |
| `events` | `EventLog` (the last 1000 events of each workspace, numbered), `Emit` (kept, published on `chat.event` and `chat.<workspace>`, which the app's WebSocket pushes to its subscribers) |

## On disk, in the project
```
.nuclear/chat/
  channels.json     [{ "id", "name", "topic", "kind": "channel|dm", "members", "team", "lastRead", "agent", "model" }]   replaced whole
  <channel>.jsonl   one message per line, appended; {"edit": "<id>", …} lines fold into it
  gifs.json         { "online": true|false }: the one question's answer
```

## What is decided here
- **A GIF's choice is the same on every read**: drawn from the message's id (its rolling sum, then Park and
  Miller's generator: every product under 2^53, exact in every target).
- **A responder is never run twice for one message**: a run's id is workspace, member and message.
- **The members' conversation**: a thread's messages, or the channel's messages outside threads, the last 40.
- **Workspaces are not kept by the service**: the host registers its project when it starts (the same folder is
  the same id, the channels' last read is kept in the project).

## Dependencies
`synapsis-py` (the fastapi dialect's runtime, with its guards and `WebSocketServer`), `websockets`, `nuclear_chat_system` (`../system`, a folder dependency of
`config.nuc`), the system's `secret-tool` / `security` / PowerShell for the keyring, `sh` only in the tests.
