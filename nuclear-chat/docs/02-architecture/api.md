---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [overview.md, responders.md, ../../../docs/04-specs/013-nuclear-chat/design.md]
---
# The API

The service on `127.0.0.1`, at the port the set-up chose (`NUCLEAR_CHAT_PORT` of `ai.env`, 7880 by default). JSON
in and out. Every route needs the header `X-Chat-Token` with the service's token (401 without it or with another);
a request with an `Origin` header (a web page) is refused (403); there are no documentation pages. A host gets the
URL, the header and the token from `nuclear-chat connect --json` (ADR-synapsis-0007, `config/project_config.nuc`).
`nuclear_chat/test/api_test.nuc` checks the guards and the socket through the app (`appClient()`, with the test
token of `testEnv` in `config.nuc`, never the keyring's; ADR-synapsis-0010).
An error answers its status with `{"detail": "…"}`: 400 a body that is not valid or a name not in the workspace,
404 no workspace, channel, message or waiting question, 409 a channel's name taken.

The fields of an answer have Nuclear's names (`lastRead`, `costUsd`), as the files on disk (ADR-synapsis-0012).

## Routes
| Route | Body | Answer |
|---|---|---|
| `POST workspaces` | `NewWorkspace` `{root, host, members, teams, channels, lang: en\|es, gifs: pack\|tenor\|giphy}` (a member's `face`: the picture the page draws, a `data:` or `https:` URL, 400 000 characters at most; its `responder` `{command, paid, choice, model, choices}`: `choices` the agents a conversation with it can choose, each `Choice` `{id, label, kind, command, paid, models, defaultModel, available, why}`, `choice` and `model` the host's default; its `brain` `{agent, kind, provider, model, paid}`: who works it, as the host says, drawn under its name in a direct message) | `Workspace` (its `id`, the channels merged: `general`, the host's, a `dm-<member>` each, the user's) |
| `GET workspaces/{id}` | | `Workspace` |
| `GET channels/{ws}` | | `Channel[]` with `unread` |
| `POST channels/{ws}` | `NewChannel` `{name, topic, members, team}` | `Channel` (201) |
| `POST channels/{ws}/{channel}/read` | | `Channel` (`lastRead` now) |
| `PUT channels/{ws}/{channel}/agent` | `AgentChoice` `{agent, model}` | `Channel` (`agent`, `model` kept in `channels.json`): who answers a direct message, one of its member's `responder.choices` (400: not a direct message with a member who has choices, no such choice, one not `available`, a model it does not offer when it offers some); `agent: ""` is the host's default again |
| `GET messages/{ws}/{channel}?thread=` | | `Message[]` (one thread with `thread`) |
| `POST messages/{ws}/{channel}` | `Said` `{text, thread?}` | `Message` (201): the user's; who it brings in answers (events) |
| `POST messages/{ws}/{channel}/gif` | `SentGif` `{gif: {src, title, source}, thread?}` | `Message` (201) |
| `POST messages/{ws}/{channel}/post` | `Posted` `{author, text, thread?, buttons, links, moment?, gif?, answersGif, costUsd?}` | `Message` (201): a host's, as a member or `system`; a GIF may follow by the member's personality: at a `moment`, or of the pack's tag `gif` (`answersGif`: the member answers a GIF of the user, likelier) |
| `PATCH messages/{ws}/message/{id}` | `Changes` `{text?, buttons?}` | `Message` |
| `POST messages/{ws}/message/{id}/reactions` | `Reaction` `{emoji, by = you}` | `Message` (the same emoji again takes it away) |
| `POST messages/{ws}/message/{id}/click` | `Click` `{button}` | `ChatEvent` (`action`) |
| `GET messages/{ws}/search?words=` | | `Found[]` `{channel, message}`, newest first |
| `POST members/{ws}/answers` | `Answer` `{id, answer}` | `Answer`: written to the responder that asked |
| `GET gifs/pack` | | `PackGif[]` `{id, file, title, tags, svg}` |
| `GET gifs/{ws}/search?q=` | | `GifResults` `{q, source, results, ask, service, note}` |
| `POST gifs/{ws}/consent` | `Consent` `{online}` | `Consent`: the one question's answer |
| `GET events/{ws}?since=` | | `ChatEvent[]` after the event `since` |

A channel called `search` or `message` is shadowed by those routes: do not use those names.

## The GIF search
The pack first (every word a tag's start or in the title; no words, all). When the workspace's `gifs` names a
service and `q` is not empty: no answer kept → the pack's results, `ask: "online"`, `service` (the page asks the
user, then `POST …/consent`); `false` → the pack's only; `true` → the key from the keyring (`no-key` in `note`
without one) and the service's results after the pack's (`note: "failed"` when it does not answer; its error is
never shown, since its URL holds the key). A pack GIF's `src` is `pack/<file>`: the page draws the `svg` of
`GET gifs/pack`.

## Events (`ChatEvent` `{n, workspace, type, channel, data, at}`)
| `type` | `data` |
|---|---|
| `message` | `{message}` (a new or changed message, folded, as the file keeps it); `said: true` on the user's new message |
| `channels` | `{channel}` (made) or `{read}` |
| `typing` | `{member, thread}` |
| `tool` | `{member, thread, tool}` (the responder's line) |
| `ask` | the responder's `ask` line with `member`, `thread` |
| `message.delta` | `{member, thread, text}`: a piece of the answer being written (the responder's `text-delta`); the page joins them until the answer is posted |
| `done` | `{member, thread, costUsd, error}`: after the answer, its GIF and a failure are posted |
| `agent.changed` | `{member, agent, model}`: a direct message's agent chosen |
| `action` | `{action: "button", message, button}` or `{action: "poc", what, message, thread}` |

Every event is kept by `EventLog` and published on two topics: `chat.event` (the members listen to it) and
`chat.<workspace>`.

## The WebSocket (`/ws`, ADR-synapsis-0008)
The same routes and the events, over one socket. The upgrade needs the same header (`X-Chat-Token`) and no
`Origin`. Frames, JSON text: a request `{"id", "method", "path", "headers", "body"}` answered `{"id", "status",
"body"}`; `{"subscribe": "chat.<workspace>"}` (and `unsubscribe`), then each event of that workspace arrives as
`{"event": "chat.<workspace>", "data": <ChatEvent>}`. A client that reconnects reads what it missed with
`GET events/{ws}?since=<the last n it saw>`.
