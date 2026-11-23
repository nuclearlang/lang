---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../01-product/roadmap.md, ../../../nuclear-builder/docs/02-architecture/chat.md, ../../../../../nuclear-chat/docs/02-architecture/ui.md]
---
# Architecture of Nuclear Atlas

The tool `atlas` of the strip (`Ctrl+Alt+A`; ADR-platform-0003): Nuclear Chat mounted as the page (spec 013 T3.3),
on the direct message with the general agent, `dm-atlas`.

## The page (`src/panel.ts`)

- On top: the project, and the templates (`templatesOf(map, platform, lang)`, `src/chat.ts`: built from the map's
  components, use cases and controllers or screens; its label and its prompt in the page's language). Atlas informs
  and routes (spec 023): the templates explain, ask which tech lead takes a task and which teams are free, and why to
  work with a team; none orders work (`/task`). The hint beside them (`role`) says what Atlas does. A template is put in the chat's composer (its `textarea`, in
  the chat's open shadow root), its `…` selected to fill.
- `AtlasPanel.compose(root, text)`: the direct message on a folder that need not be a project (a Nuclear workspace,
  or the extension's own folder for the welcome before there is one; listed in the project picker), with `text` put
  in the composer once the chat is drawn, for the user to read and send: the welcome's and the workspace menu's *Do it
  with me by chat* (spec 022).
- The chat's folders (`chatRoots` of `src/chat.ts`): the open workspace first (`AtlasPanel.workspace`: its own channel
  `home`, the team assigned to the whole workspace), then its projects; the chat opens on the workspace, and choosing
  an app to run does not move it (only a member or a channel clicked in a project's Builder does). With no workspace
  and no project it opens on `AtlasPanel.fallback` (the welcome's folder); the prompts to start from are shown only on
  a project.
- Below: the embedded chat (`out/chat-embed.js`) mounted on `/<workspace>/dm-atlas`, its frames over `postMessage`
  to the window's one connection (`vscode/src/chatHost.ts`, `chatView.ts`, shared with the Builder). The service down
  is said on the page with how to fix it.
- The channels in the workspace's column: while Atlas is the open tool and the column is seen (`AtlasPanel.split`),
  the column mounts the chat's `?part=sidebar` on the page's folder and channel (`AtlasPanel.target`) and the page
  only `?part=channel`. Each side tells the host the channel it marks read (`readChannelOf` of a frame,
  `wireChat`'s `onRead`): one opened in the column opens in the page (`AtlasPanel.show`), one the page moves to
  (a link, Ctrl+K, a notification) remounts the column on it (`AtlasPanel.moved`). The column hidden, the page
  shows the whole chat again.
- The last conversation of each folder: every channel the page opens is kept in the window's state
  (`nuclear.atlas.channels`, `withLast` of `src/chat.ts`); a new page, or another folder chosen, opens there
  (`lastChannel`, else `dm-atlas`), unless it was opened on a channel (a notification, the Builder, the welcome's
  chat). A conversation deleted is forgotten (`withoutChannel`, on its `channels` event).

## A question

A message in `dm-atlas` is answered by the member `atlas` (`nuclear-builder member --role chat`, the provider of
`nuclear.builder.chat`: an external agent or provider, Claude Code by default, which reads the Smart Graph through
the MCP server; the local models are on standby, ADR-platform-0013). When `agents --json` (the Builder's
`agentsHere`) has no agent available, the page shows a line over the chat that says how to pick one, and its link
opens Settings and integrations on Nuclear Builder. An agent (a subscription) answers without the two spending
questions, and so does an API the user already put in the team (a member's or the tech lead's); an API never chosen
asks them, and `forceConfirm` asks every one (`registration` in
`vscode/src/chatHost.ts`). The conversation is the chat's, kept in the project (`.nuclear/chat/dm-atlas.jsonl`), the same in the Builder's chat.

## No task

Atlas informs and runs no task (spec 023, requirement 1): asked for work, its answer (the engine's) sends the user to
a team's tech lead and the teams that are free. `/task …` said in `dm-atlas` (the chat answers no message that starts
with `/`) is answered by Atlas's host in its thread (`noTaskText` of `src/chat.ts`): ask a tech lead, each lead of the
project's registration as a link to their conversation (`#dm-<lead>`), or, with none, an offer to make a team.

## In the workspace

The notices of Nuclear Atlas are the workspace's: what members say to the user in Nuclear
Chat (a direct message, `@you`, a question, an answer), counted on the `atlas` badge of the strip and the activity
bar ([the notifications](../../../../vscode/docs/02-architecture/ai-services.md)). *Open* on a chat notice, and the command `nuclear.atlas.open` (root, channel) that Nuclear Builder and the company
screen run when a member or a team is clicked (the Builder has no chat of its own), call
`AtlasPanel.show(…, channel)`: the page opens (or mounts the chat again) on that channel, the direct message with
the member or the team's channel; choosing another project goes back to Atlas's direct message. Its texts are in English and Spanish in
`src/l10n.ts`, in the chosen language (`nuclear.language`); the globe in its header changes it, and the page and the
chat's registration follow at once.
