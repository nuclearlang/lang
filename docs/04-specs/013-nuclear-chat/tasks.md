---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [requirements.md, design.md]
---
# Spec 013 — Tasks

Each phase ends with its tests green and its projects' documents saying it (AGENTS.md rule 7).

## Phase 0: the decisions

- [x] T0.1 ADR-platform-0007 (everything is a component) and ADR-platform-0008 (Nuclear Chat).
- [x] T0.2 This spec; spec 011's requirement 21 points here.

## Phase 0b: the framework (spec 014)

- [ ] T0.3 Synapsis: real time in `backend` and the embedded mode of `web` (spec 014), before phases 1 and 2 need them.

## Phase 1: the component (C)

- [x] T1.1 `nuclear-chat/`: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/` (vision with the philosophy, domain,
      architecture, the process contract, roadmap, guides), `nuclear.toml`, `pyproject.toml`; the root `AGENTS.md`
      and `docs/README.md` list it (ADR key `chat`).
- [x] T1.2 The engine: channels, messages, threads, mentions, reactions, edits, the history and its search, the
      unread counts; tests.
- [x] T1.3 The service (Synapsis `backend`, made with `nuclear new`/`gen`): the routes, the token, the port, the
      responders (run, typing, ask relayed, cost), its events pushed (spec 014); tests with a stubbed responder.
- [ ] T1.4 The GIFs: the pack (30+ made for the project), the personality's choice, Tenor and Giphy with the key in
      the keyring and the one question; tests with HTTP stubbed.
- [x] T1.5 `installer/install.sh` installs `nuclear-chat`; the AI archive carries it.

## Phase 2: the UI (C)

- [x] T2.1 `nuclear-chat/ui/`, a Synapsis `web` project built embedded: Slack's layout, the thread, the composer with completion, the GIF picker,
      reactions; English and Spanish; the bundle the VS Code extension carries (2026-11-18,
      `nuclear-chat/docs/02-architecture/ui.md`). Its writes reach the service once the compiler's contract writes
      `@body` (nuclear-chat's roadmap, "The UI talks to the service").
- [x] T2.2 Tests of the project (`nuclear test`, vitest: 9) and the page checked rendered in a headless browser with a
      fake bridge (en and es, dark and light, wide, a dock, narrow).

- [x] T2.3 Conversations and the search, as in Slack (requirements 1–4, 10, 11, 14): a message edited (the user's) and
      deleted (any, confirmed; its thread stays); a conversation closed, archived, opened again, renamed, its topic
      changed, deleted (its history moved to `.nuclear/chat/deleted/`); a channel made with chosen members; the quick
      switcher (Ctrl+K, the pencil) and the members list to start a direct message with anyone; the search with
      `from:@member` and `in:#channel` whose result opens the message lit (also `?message=&thread=`, a notification's
      click). Service and UI tests, e2e against the live service, rendered en/es (2026-11-18).

## Phase 3: the hosts (H)

- [x] T3.1 Nuclear Builder: `nuclear-builder member --team --role --events` (the responder: the role's provider,
      the factory's tools, the money) replaces `nuclear-builder chat`, gone (2026-11-18); the host file from the
      project's teams (`nuclear-builder chat-host --json`, `extensions/tools/nuclear-builder/member.nuc`).
- [x] T3.2 The Builder's page mounts the chat (dock and tab); a run posts in its team's channel as a thread (its
      stations, its members' questions with buttons that answer the run, a GIF on failure by personality); a
      spec's thread polishes its draft (the difference accepted: `spec_draft`, `spec accept|discard`); `/poc` is
      told not available: the factory cannot run on a scratch folder yet (the Builder's roadmap) (2026-11-18,
      `extensions/tools/nuclear-builder/docs/02-architecture/chat.md`).
- [x] T3.3 Nuclear Atlas mounts the chat as its page (`dm-atlas`, the general agent); its `/task` and its templates
      stay (2026-11-18).
- [ ] T3.4 Setting `nuclear.chat.gifs` in the onboarding and *Settings and integrations*, the GIF key from the
      editor (done 2026-11-18); the knowledge base follows; the extensions are released (the user releases).

## Phase 4: a front for any agent (requirement 17)

- [x] T4.1 The agents on this machine (`nuclear-builder agents --json`, the tool `agents_list`), the host file's choices for the general agent, the service's choice per conversation (`PUT channels/{ws}/{channel}/agent`, `agent.changed`), the responder run with it; streamed answers (`text-delta` → `message.delta`; Claude Code only: the other agents' streaming is the Builder's roadmap). 2026-11-18.
- [ ] T4.2 The dropdown in the UI's header, the default local agent, the answer as it is written, en/es (done 2026-11-18: rendered and checked); release (left).

