---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0008: Nuclear Chat, the factory's workplace, is a project of its own

## Context and problem
The Builder's chat was one general agent answering in a box under the diagram (ADR-platform-0006); Nuclear Atlas
had its own chat. The Builder is a software factory with teams the user builds, each member with a name and a
personality; the user wants to work with them as a company works in Slack: talk to a team or to one member, be
asked when they do not understand, polish a spec or a requirement together, try a proof of concept, and see how
the work goes, with the members' character (a GIF now and then when something fails).

## Decision
1. **`nuclear-chat/`, a project at the root** (ADR key `chat`), after ADR-platform-0007, **made with Synapsis**
   (rules 9 and 13 of the root `AGENTS.md`): the workplace's service is a Synapsis `backend` project on
   `127.0.0.1` with a token on every route (channels, direct messages, threads, mentions, members, reactions,
   GIFs, the history, the responders), its events pushed over a WebSocket connection its config declares; its UI
   is a Synapsis `web` project that the editors' pages embed. What Synapsis lacked for it (WebSockets as a
   connection, being embedded in a host's page in
   `web`) is added to the framework first (spec 014), never worked around in another language.
2. **Its users are hosts**: the Builder (the teams as channels and members, a run as a thread, its questions as
   messages that answer it) and Nuclear Atlas (the local assistant as a member). A host gives the members and how
   each one answers (a responder: the member's provider through the host's adapters); the chat never knows how a
   factory runs.
3. **A member speaks as their profile.** The roster's profile (name, bio, the HR note) is the member's character;
   a trait says how often they send a GIF and when (a failure, a success, a question).
4. **GIFs: a pack of the project first, a service when the user wants it.** A pack made for the project (no
   third-party images, works offline); Tenor or Giphy with a key in the system's keyring, opt-in, and the user is
   told that the search words leave the machine.
5. **The money is the factory's rule**: a member worked by a paid provider is confirmed twice like a run, inside
   the same budget.

This amends ADR-platform-0006: the chat is no longer the Builder's process (`nuclear-builder chat`) but this
component.

## Options considered
1. Keep the chat inside the Builder and copy it into Atlas.
2. A real Slack workspace with bots: an account, a third party and the project's work outside the machine.
3. A component of the platform, local, used by every tool that talks.

## Consequences
- Positive: one chat for every tool; the factory's work reads as a conversation the user takes part in; nothing
  leaves the machine unless the user turns a GIF service on or chooses a paid provider.
- Negative: a new project to keep, and the framework must grow first (spec 014); the Builder and Atlas move to its contract; the JetBrains window gets it later.

## References
- Amends: ADR-platform-0006
- Follows: ADR-platform-0007
- Spec: [013 — Nuclear Chat](../04-specs/013-nuclear-chat/requirements.md)
