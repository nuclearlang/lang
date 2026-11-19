---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0001: The engine is a Synapsis backend service, and the machine is a small library

## Context and problem
Spec 013 first designed the engine as a process per project and window (`nuclear-chat serve --events`, JSON lines
both ways). The user decided that Nuclear Chat is made with the framework: one local service, like the Nuclear
Developer, that the hosts call and that pushes in real time through Synapsis (spec 014). The chat must also
touch the machine: append to a project's files, run a member's command and write to it while it runs, read the
keyring, find its GIF pack. Platform Nuclear has no word for any of these.

## Decision
1. **The service is a Synapsis backend** (`nuclear_chat/`, platform `backend`, dialect `fastapi`), made with
   `nuclear new`, `nuclear make` and `nuclear gen resource` (Tenor, Giphy), one component per concern
   (workspaces, channels, messages, members, gifs, events). Every rule of the chat is there, in platform Nuclear.
2. **What touches the machine is `system/`**, a project in the `python` dialect (`nuclear_chat_system`): four
   classes with no rule of the chat (`ChatFiles`, `Processes`, `Keyring`, `ChatPack`) and the `nuclear-chat`
   command. The service depends on it as the Developer depends on the graph's package (a folder dependency typed
   by `defs/`). When the platform gains these words, a class leaves `system/`.
3. **The history stays the spec's files** (`.nuclear/chat/*.jsonl`, appended), not a database: it is the
   project's, readable and safe after a crash.
4. **Push is one place**: every event goes through `EventsAppComponent.emit` (kept, published on `chat.event`);
   spec 014's WebSocket transport serves it. Until then a client reads the events from a cursor.

## Options considered
1. The process per window of the first design: two engines once the framework pushes, and no service to share.
2. Everything in the `python` dialect: the chat's rules tied to one language, outside the framework.
3. A Synapsis service with a system library for what the platform cannot say yet.

## Consequences
- Positive: the chat's rules are platform Nuclear (a `nestjs` build needs only `system/` in TypeScript); one
  service for every host; the generators wrote the pieces; the findings went to the tools' roadmaps.
- Negative: two projects to build, and the system's type definitions to regenerate after a change; the service
  waits for spec 014's guard before it is installed.

## References
- Spec 013 (its design's process contract is replaced by [api.md](../02-architecture/api.md)); spec 014.
- ADR-platform-0007, ADR-platform-0008, ADR-platform-0004.
