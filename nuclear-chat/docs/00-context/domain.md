---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [vision.md, ../02-architecture/api.md]
---
# Domain

| Word | Meaning |
|---|---|
| **host** | a tool that uses the chat (`builder`, `atlas`): it registers a project with its members, teams and channels, and gives each member a responder |
| **workspace** | a project registered by its host; its id (`w…`) is its folder's fingerprint, the same folder is the same workspace |
| **member** | someone of a team as the host gives them: `id`, `name`, `role`, `team`, `avatar` (the host's id of their portrait), `face` (the picture the page draws: a `data:` or `https:` URL), `profile` (bio, HR note, language), `personality`, `responder` |
| **team** | a team at work in the project: `id`, `name`, `lead` (the member id of its tech lead) |
| **tech lead** | the member who answers a message to the team: its channel without a member mentioned, `@<team>`, a thread of its channel; without `lead`, the team's first member |
| **channel** | `general`, one per team (its `team`, or its id is the team's), one the user made, or a direct message `dm-<member>` (kind `dm`) |
| **you**, **system** | the user's author id, and the author of the chat's own messages (a member that could not answer) |
| **message** | a line of a channel: `id`, `at`, `author`, `text`, `thread`, `gif`, `reactions`, `buttons`, `links`, `costUsd` |
| **thread** | the replies to a message: each names it in `thread`; the message shows `replies` and `lastReply` |
| **line**, **fold** | a channel's file holds one JSON line per message, and one per edit or reaction (`{"edit": "<id>", …}`); reading folds them into the messages |
| **mention** | `@<id>`, `@<name>` (without spaces), `@<first name>`, `@<role>` (the channel's team first), `@<team>` (its tech lead) |
| **link** | `spec:<id>` and `run:<id>` in a text: the factory's work it names (`links`) |
| **responder** | a member's command, run once per answer with `--events`: the conversation in, JSON lines out ([responders.md](../02-architecture/responders.md)) |
| **ask** | a responder's question to the user; the user's answer is written back to it |
| **action** | something for the host: a button clicked, `/poc <what>` (a proof of concept) |
| **event** | what happened in a workspace (`message`, `channels`, `typing`, `tool`, `ask`, `done`, `action`), numbered `n` |
| **moment** | when a member may send a GIF: `failure`, `success`, `question` |
| **personality** | `gifs`: `never`, `sometimes` (one in five of its moments, one in two of the GIFs they ask for), `often` (one in two of its moments, nine in ten of their asks); `on`: its moments |
| **pack** | the GIFs drawn for the project (`pack/`, `src` `pack/<file>`); **service**: Tenor or Giphy, with the user's key |
| **the one question** | whether a project's GIF searches may leave the machine, asked once (`gifs.json`) |
