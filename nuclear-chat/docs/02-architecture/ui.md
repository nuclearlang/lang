---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [overview.md, api.md, ../../../docs/04-specs/013-nuclear-chat/design.md, ../../../nuclear-synapsis-framework/docs/03-adr/0009-a-web-app-mounts-in-a-host-page.md]
---
# The UI (`ui/`)

The page the hosts mount: Slack's shape over the service (spec 013, requirement 14). A Synapsis `web` project
(dialect `react`) made with `nuclear new ui -p web --websocket`, built as the embedded bundle
(ADR-synapsis-0009): `build/app/dist-embed/embed.js`, one ES module with React inside.

## How a host mounts it
```js
import { mount } from './embed.js';
const unmount = await mount(element, { path: `/${workspace}/general`, bridge });
// bridge = { send(frame), onMessage(callback) }: the host forwards the frames to the service with its token
```
`path` is `/<workspace>/<channel>` (the route of `ChatScreen`; the workspace is the id `POST workspaces` gave the
host). Every call and every event travels as the frames of ADR-synapsis-0008 over the bridge: `{id, method, path,
headers, body}` out, `{id, status, body}` and `{event, data}` back, `{subscribe: "chat.<workspace>"}` for its workspace. On its own (no
bridge) the app uses `config/project_config.nuc`'s `WebSocket(connectionName = "nuclear_chat", url =
"ws://127.0.0.1:7880/ws")`, which a guarded service refuses (a browser sends no token): it is for a host.

## The project
| Folder | What |
|---|---|
| `config.nuc` | `contracts(nuclear_chat = "../nuclear_chat")`: every build writes `contracts/nuclear_chat/` (the models and one repository per controller) from the service's `.nuclear/contract.json` |
| `components/{channels,messages,members,gifs,events}/` | a facade and a use case per call (the conversations' `ChangeChannel`, `DeleteChannel`, `UpdateMessage`, `DeleteMessage`, `SearchMessages` too), all written by `nuclear gen usecase <c> <Name> --calls <Repository>.<method>`; `events/data/live_repository.nuc`: `@on("chat.${workspace}") events(workspace: string) Stream<ChatEvent>` |
| `components/chat/` | the screen: `chat_screen.nuc`, its nine managers and state models, `widgets/` by feature (sidebar, channel header, the conversation's menu, the agent's picker, message list and row, an answer being written, markdown, composer, GIF picker, thread, search, quick switcher and members list, new channel, typing and questions, avatar, times), models `Thread`, `Activity`, `Part`, `Question`, `Completion`, `Target` |
| `shared/models/texts.nuc` | every text in English and Spanish (`Texts(lang)`, `get`, `format`) |
| `public/styles.css` | the stylesheet, inside the shadow root |
| `test/chat_test.nuc` | the tests (vitest + jsdom) |

## The screen
`ChatScreen(workspace, channel, message, thread)` provides nine managers; each reads one thing and listens to the service's events
of its workspace:

| Manager | State | Reads again when |
|---|---|---|
| `WorkspaceManager` | the workspace (members, teams, `lang`) | the screen opens |
| `PackManager` | the pack's drawings (`GET gifs/pack`) | once |
| `ChannelsManager` | the channels with unread counts and each direct message's agent | a `message`, `channels` or `agent.changed` event; the open channel is marked read (`POST …/read`); `chooseAgent` (`PUT …/agent`) |
| `MessagesManager` | the open channel's messages outside threads | a `message` event of that channel; it also says, sends a GIF, reacts, clicks |
| `ThreadManager` | the open thread (`?thread=`) | a `message` event of its channel |
| `ActivityManager` | who is typing or using a tool, and the answer as it is written (its text and tools, `Part`s) | `typing`, `tool`, `message.delta`, `done`, the member's `message` |
| `QuestionsManager` | the members' questions (`ask`), answered yes or no (`POST members/{ws}/answers`) | `ask`, `done` |
| `PickerManager` | a GIF search, the one question (`ask: online` → `POST gifs/{ws}/consent`) | each search |
| `SearchManager` | the search of every message (`GET messages/{ws}/search`): idle, searching, found | each word typed |

`ChannelsManager` also makes a channel, changes one (`PATCH`: name, topic, closed, archived, open) and deletes one;
`MessagesManager` edits the user's own message (`PATCH …/message/{id}`) and deletes any (`DELETE`).

A message event makes its channel read again (one `GET`), not decoded from the event: an event carries the raw line
of the file (a said message has no `buttons`), and the read answer is the folded message.

What it shows: the channels and the direct messages with their unread badges (a team's channel with its tech lead,
also as a chip in the channel's header); the messages grouped by author and minute with a divider per day (the member's
`face`, else their initials on a color of their own, or the chat's own mark, name, role chip, *Tech lead* and *paid* chips, time, cost); the text as markdown built into
elements (fenced code, inline code, bold, italic, strike, quotes, lists, links, `@mentions`, `#channels` that open
them, `spec:`/`run:`), never as HTML; the pack's GIFs drawn from their SVG as an image (`data:` URL: its scripts
never run) and a service's by URL; the buttons of a member's question; reactions (the user's own marked, click to
add or take away) and six quick ones on hover with *Reply in thread*; a thread's count and last reply. The thread
opens beside the channel.

**Conversations, as in Slack** (requirement 14): the sidebar's pencil (*New message*) and *Jump to…* open the quick
switcher, also Ctrl+K or ⌘K anywhere in the chat: a name, a first name or a role opens the direct message with any
member of the workspace, a channel's name jumps to it (a closed or archived one too, marked); the arrows move, Enter
opens, Escape closes. *Members* (and a channel's member count) opens the members list: each one's face, name, role,
*Tech lead* and the brain that answers as them, and *Message*. The + of *Channels* makes a channel (name, topic, the
members chosen by their faces; a name taken is said in the dialog). The header's ⋯ renames a channel and edits its
topic, closes the conversation (out of the sidebar; the page goes to `#general`; opening it again from the switcher,
a search or a member's new message brings it back), archives a channel (read only: where the composer was, a bar
with *Open it again*) and deletes the conversation after a confirmation in the menu (its history moved to
`.nuclear/chat/deleted/`). On a message's toolbar: *Edit* on the user's own (in place: Enter saves, Escape cancels)
and *Delete* on any, confirmed in the row; a deleted message says *This message was deleted.* and keeps its thread.
The header's *Search* opens the search where the thread goes: every message as the user types, `from:@member` and
`in:#channel`, each result with its conversation, *in a thread*, author, day and time and its words marked; a click
opens its channel at the message (and its thread for a reply), lit and scrolled to once. The route's query does the
same for a host: `/<workspace>/<channel>?message=<id>&thread=<id>` (a notification opens the exact message).

**Who answers is in sight**: a direct message with a member shows under their name the brain that answers as them
(`BrainLine`, from the host's `brain`): the agent's mark, `<agent> · <model>` and a *paid* or *local* chip; a team's
channel is titled with the team's name. While a local member answers, the typing line says it is the local model and
that the first answer takes longer while it loads (`typing.local`).

**A front for any agent** (requirement 17): a direct message with a member whose responder has `choices` (the
general agent) shows who answers it in its header (`AgentPicker`, as in Claude's own app): a pill with the agent's
mark (local, an agent's command line, an API), its name, its model and *paid*; its menu lists the host's choices,
one not on this machine disabled with its `why`, then the chosen agent's models (its own default first when it has
one; a free model typed when it lists none). The default is the conversation's own choice, else the host's, else the
local agent (`chosenAgent`, `chosenModel`); a pick calls `PUT …/agent`. The answer arrives as it is written
(`Streaming`, after the messages and in a thread): the member's row with *writing…*, its text as markdown (a fence
not closed yet drawn as code), each tool it calls as a chip that spins, then turns green or red, and a caret; the
posted answer replaces it with its cost. The composer completes `@` (members by name or role, teams), `#` (channels), `/` (`/poc`,
`/gif`), Enter sends and Shift+Enter breaks the line; a text that was not sent stays with why. Empty, loading and
error states for the workspace, a channel and a thread.

## Look
Every color is a CSS variable: the host's `--chat-*` first, then an editor's `--vscode-*` (VS Code's webview gives
them), then the chat's own light or dark default (`prefers-color-scheme`). Container queries on the page: below 720
px wide the channels fold behind a menu and the thread covers the channel; below 420 px tall (an editor's dock) every
spacing is tighter.

## Commands
```sh
cd ui && nuclear check --json && nuclear build && nuclear install    # [] then build/app with its packages
nuclear test                                                         # vitest: 18 tests
cd build/app && npm run build:embed                                  # dist-embed/embed.js, what a host carries
nuclear fmt --check .
```
The page was checked rendered in headless Chromium with a fake bridge answering the frames with sample data (en and
es, dark and light from VS Code's variables, wide, a 300 px dock, 420 px narrow; the agent's menu open, an answer
streamed with code and tool chips), and the conversations and the search against the live service through a relay
that adds the token (the quick switcher, the members list, a search and its jump into a thread, a deleted message
and its confirmation, a direct message closed, an archived channel, the new channel dialog; en and es, a dock).

## What it waits for
- An attribute whose name is not an identifier (`aria-label`, `aria-selected`) cannot be written yet (the web
  platform's roadmap): the dialogs and the icon buttons are named by `title`.
- Ctrl+K reaches the chat while the focus is inside it; an editor may keep the chord for itself when it is not.
- The texts are in one Nuclear model (`shared/models/texts.nuc`): the web platform has no translations yet.
- A manager keeps an alias's `Result` and matches it (each marked `shortcut:`): an appcomponent alias does not
  propagate a `Result` yet (the compiler's roadmap).
