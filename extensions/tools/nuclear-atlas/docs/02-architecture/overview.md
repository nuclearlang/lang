---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../01-product/roadmap.md, ../../../nuclear-builder/docs/02-architecture/engine.md, ../../../../vscode/docs/02-architecture/ai-services.md]
---
# Architecture of Nuclear Atlas

The tool `atlas` of the strip (`Ctrl+Alt+A`; ADR-platform-0003). Never opened in a running VS Code
([roadmap](../01-product/roadmap.md)).

## A question

A message goes to `POST /developer/chat` of the Nuclear Developer with:

- `message`: the question;
- `platform`: the project's;
- `map`: `.nuclear/map.md`, clipped to 12 000 characters (`MAP_LIMIT`);
- `history`: the last 8 messages of the session (`HISTORY`, `historyOf`).

The local assistant answers from the project's map and the Smart Graph. Before it, `checkForChat` checks what the
question needs ([the checked connections](../../../../vscode/docs/02-architecture/ai-services.md)).

## An order

`/task <text>` builds a local-led `Spec` (`criteriaOf`) and runs a `BuilderEngine` in place: the local agents plan it,
write the tests first, then the code, run the tests and the security review. Each step is drawn as it ends, and the
answer is the run's `notes` and its journal (*Open the journal of the run*)
([Nuclear Builder's engine](../../../nuclear-builder/docs/02-architecture/engine.md)).

## Jobs and sessions

- A job is `ask` or `drive`. Jobs are module-level (`jobs` in `panel.ts`): a job goes on with the page closed,
  and `append` saves its answer in the session; a notice tells the user when it ends.
- A session is `.nuclear/chat/<id>.json` (`CHAT_DIR`; `listSessions`, `saveSession`), listed on the left of the
  page.

## What the page draws (`panel.ts`)

- The answers, with their markdown rendered by the page itself: code blocks, inline code, bold, lists.
- Under each answer, folded in grey, what the agent did: its `steps`, its `seconds` and its `tokens` (the
  assistant's `context` trace; `tokensOf` = characters / 4).
- The context meter: how full the local model's window is (`nuclear.ai.contextTokens`); it tells the user to start
  a new session when it is near.
- ↑ / ↓ in the input go through the questions asked before (`askedOf`).
- *↻ Retry* of a failed question (the `ask` message), or of a failed order from its failed step.
- The templates above the input: `templatesOf(map, platform)`, built from the map's components, use cases and
  controllers or screens.
- A failed run's diagnosis.

## In the workspace

The notices of Nuclear Atlas are the workspace's: the count on the `atlas` tab and the badge of the activity bar
([the notifications](../../../../vscode/docs/02-architecture/ai-services.md)).
