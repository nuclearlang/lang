---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [api.md, ../00-context/domain.md, ../../../docs/04-specs/013-nuclear-chat/design.md]
---
# The responders

How a member answers (spec 013, design.md "The responder"). The chat runs the member's `responder.command`, with
`--events` added when it is missing, once per answer, in the project's folder (`Responders`, `members`).

## Which command (`Responder.run`)
A member whose host gave `choices` (requirement 17: the general agent) is answered by the choice its direct message
chose (`PUT channels/{ws}/{channel}/agent`), else by the host's `choice`, each only when it is `available`; the
choice's `command`, with `--model <model>` added when a model is chosen (the conversation's, or the host's `model`
for its default). With no choice, `command` and `paid` as they are. What a choice runs is the host's: the chat only
picks it.

## Who answers (`Routing`)
1. A direct message (`dm-<member>`): its member.
2. Each member mentioned, in order: `@<id>`, `@<name>` without spaces, `@<first name>`; then `@<role>` (a member of
   the channel's team first, then of the channel, then any).
3. `@<team>` (its id, or its name without spaces): the team's tech lead.
4. In a team's channel (its `team`, or its id is a team's), a message that mentions no member: the tech lead.
5. Nobody else: `#general` without a mention is not answered. A message that starts with `/` is a command (`/poc`
   is the host's action). The user's GIFs are not answered.

## In: one line on stdin
`{"workspace", "root", "member", "channel", "thread", "messages", "said", "lang", "gifTags"?}`. `messages`: the last
40 of the conversation (the thread's, or the channel's outside threads), each `{id, at, author, text, thread, gif}`
(`gif`: its title). `lang`: the member's profile language, else the workspace's: the user's chosen language, which
the member answers in (or in the language the user's message is written in). `gifTags`: every tag of the pack,
only for a member whose personality sends GIFs.

## Out: JSON lines on stdout
| Line | What the chat does |
|---|---|
| `{"type": "typing"}` | the event `typing` |
| `{"type": "text-delta", "text"}` | the event `message.delta`: the answer as it is written (optional; the answer is still the `text` lines) |
| `{"type": "text", "text"}` | kept; the texts, joined, are the member's answer |
| `{"type": "tool", …}` | the event `tool` |
| `{"type": "ask", "id", "kind", "question", …}` | the event `ask`; the user's answer (`POST members/{ws}/answers`) is written back on stdin: `{"type": "answer", "id", "answer"}` |
| `{"type": "done", "costUsd", "error"?, "moment"?, "gif"?}` | the end: the answer posted as the member (with `costUsd`; a `moment` or `gif`, a tag of `gifTags`, may bring their GIF); an `error`, posted by `system` |

## A member's GIF (`GifChoice.pick`)
A `gif` tag in `done` is the member asking for a GIF after their answer; the chat decides, by the personality as a
cap: `never` sends none; `sometimes` keeps one ask in two, `often` nine in ten; when the user sent a GIF just before
the message answered (their last messages), four in five and always. A moment's tag (`failure`, `success`,
`question`) only when the personality's `on` names it. The GIF is one of the pack's with that tag (else a tag that
starts with it), posted as the member's next message; the draws come from the answer's message id, so a history
read again shows the same. A tag that is not a lowercase word is left out. The responder never shows its `gif:`
line as text.

A line that is not JSON is skipped. A command that ends without `done` is told by `system`: `<name> could not
answer: it ended (<code>) without done: <the end of its stderr>`. A command that is not installed is told the same
way (`cannot answer`).

## The money
The chat never spends. A responder worked by a paid provider asks before it spends (two `ask` of kind `spending`,
spec 011 requirement 16) inside its team's budget, and gives the cost in `done`; the chat shows it on the message.
