---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../01-product/roadmap.md, ../../../nuclear-builder/docs/02-architecture/chat.md, ../../../../../nuclear-chat/docs/02-architecture/ui.md]
---
# Architecture of Nuclear Atlas

The tool `atlas` of the strip (`Ctrl+Alt+A`; ADR-platform-0003): Nuclear Chat mounted as the page (spec 013 T3.3),
on the direct message with the general agent, `dm-atlas`.

## The page (`src/panel.ts`)

- On top: the project, and the templates (`templatesOf(map, platform, lang)`, `src/chat.ts`: built from the map's
  components, use cases and controllers or screens). A template is put in the chat's composer (its `textarea`, in
  the chat's open shadow root), its `…` selected to fill.
- Below: the embedded chat (`out/chat-embed.js`) mounted on `/<workspace>/dm-atlas`, its frames over `postMessage`
  to the window's one connection (`vscode/src/chatHost.ts`, `chatView.ts`, shared with the Builder). The service down
  is said on the page with how to fix it.

## A question

A message in `dm-atlas` is answered by the member `atlas` (`nuclear-builder member --role chat`, the provider of
`nuclear.builder.chat`: by default the local Nuclear Developer, which reads the Smart Graph). The conversation is the
chat's, kept in the project (`.nuclear/chat/dm-atlas.jsonl`), the same in the Builder's chat.

## An order

`/task <text>` said in `dm-atlas` (the chat answers no message that starts with `/`): Atlas's host sees the event,
writes a spec (`specs/<id>/spec.md`, its criteria by `criteriaOf`) and runs it through the Builder's `driveRun` with
the project's team. The run is told by its members as a thread of the team's channel; Atlas posts in the order's
thread where it went and how it ended (passed, failed, waiting), and a notice says so when the page is closed.

## In the workspace

The notices of Nuclear Atlas are the workspace's: its orders' ends and what members say to the user in Nuclear
Chat (a direct message, `@you`, a question, an answer), counted on the `atlas` badge of the strip and the activity
bar ([the notifications](../../../../vscode/docs/02-architecture/ai-services.md)). *Open* on a chat notice calls
`AtlasPanel.show(…, channel)`: the page opens (or mounts the chat again) on that channel, the direct message with
the member or the team's channel; choosing another project goes back to Atlas's direct message. Its texts are in English and Spanish in
`src/l10n.ts`, in the chosen language (`nuclear.language`); the globe in its header changes it, and the page and the
chat's registration follow at once.
