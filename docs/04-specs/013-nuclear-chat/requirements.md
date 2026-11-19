---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [design.md, tasks.md, ../011-software-factory/requirements.md, ../../03-adr/0008-nuclear-chat-the-factorys-workplace.md, ../../03-adr/0007-everything-is-a-component.md]
---
# Spec 013: Nuclear Chat, the factory's workplace — Requirements

## Goal

The software factory (spec 011) has teams the user builds, each member with a name and a personality. **Nuclear
Chat** is where the user works with them, as a company works in Slack: the user talks to a team or to one member,
the members ask when they do not understand, a spec, a feature or a requirement is polished in a conversation, a
proof of concept is tried, and the work of every run is told there as it happens. It is a component of its own
(ADR-platform-0007, ADR-platform-0008), used by Nuclear Builder and Nuclear Atlas. Asked by the user on 2026-11-18.

## Philosophy: why each thing exists

- **The workplace, not a prompt box.** A factory is people working together; the user is the head of the company.
  The chat makes the work a conversation the user takes part in, instead of logs read after the fact.
- **Talk to who does the work.** A question about the tests goes to the QA of the team, by name; that member
  answers as their role and through their provider, with what they did in front of them.
- **They ask, they do not guess.** A member that does not understand stops and asks in the chat (the factory's
  rule: nothing is guessed); the answer goes back to the work.
- **Character makes it readable.** The satirical profiles are not decoration: a member speaks as their profile, so
  who said what is obvious at a glance; a GIF now and then says a failure or a success faster than a paragraph.
- **Local and private by default.** The history stays in the project; nothing leaves the machine unless the user
  turns a GIF service on or puts a paid provider on a member, and then it is told and confirmed.
- **One chat for every tool.** The Builder and Atlas mount the same component; neither has its own.

## Requirements

1. **Channels**: `#general` of the project, one channel per team at work in the project (`#<team>`), and channels
   the user creates. A channel has a name, a topic and its members.
2. **Direct messages** with any member of a team, and with the general agent (the setting of the factory's chat
   provider).
3. **Threads**: a reply opens a thread under a message; a run of the factory is a thread in its team's channel
   (started by the run, followed by its stations), and a spec has its own thread to polish it.
4. **Mentions**: `@<member>` (by name or role: `@qa`) brings a member into the conversation, who answers;
   `#<channel>` links a channel, `spec:<id>` and `run:<id>` link the factory's work.
4b. **Every team has a tech lead, who answers for the team** (the user, 2026-11-18): one of its members, chosen by
   the user (the Architect by default). A message to the team (its channel, `@<team>`, a run's thread) is answered
   by the tech lead, who speaks for everyone and brings in a member when the question is theirs. The user can
   still write to any member (a direct message, `@<member>`): that member answers, and the tech lead stays
   accountable for the team's work.
5. **Members answer as themselves**: their profile (name, bio, the HR note) and their temperament (spec 011,
   requirement 28: extrovert, shy, nerd…) are their character; their role's
   files and the team's instructions are what they know; they answer through their role's provider and model
   (local, a provider's agent, an API model), with the factory's tools (read a run, write or change a spec's
   draft, start a proof of concept) — never by editing a role's files.
6. **Members ask**: a question of a run (a gate, an unclear fact, QA's plan, the spending) is a message of the
   member who asks, in the run's thread, with its answers as buttons; answering in the chat answers the run.
7. **Polish a spec**: in a spec's thread the user and the members change its draft (title, description,
   criteria, component, layer); every change is shown as a difference the user accepts; the spec is written only
   when the user accepts it.
8. **Proofs of concept**: `/poc <what>` asks a member (the Architect by default) for a small experiment, run by the
   factory in a scratch folder of the project (`.nuclear/poc/<id>/`), never in the project's code, with its result
   in the thread.
9. **GIFs**: the user sends a GIF from a picker (search, then pick); members send one now and then, by their
   personality (a trait: never, sometimes, often; and when: a failure, a success, a question), and may answer with
   one when it fits (the user sent a GIF, a joke, a success, a failure), the personality capping how often; the user
   never sees the words that ask for it (the user, 2026-11-18). The GIFs come from
   a pack made for the project (no third-party images, works without a network) and, when the user turns it on
   with a key in the system's keyring, from Tenor or Giphy; the first search tells the user that the search words
   leave the machine.
10. **Reactions** on any message (an emoji), and the unread count of each channel.
11. **The history** stays in the project (`.nuclear/chat/`), one file per channel, appended; it survives the
    editor and a crash; a channel can be searched.
12. **Money**: a member worked by a paid provider spends inside the team's budget, confirmed twice like a run
    (spec 011, requirement 16, with *force confirmation*); the spending of each message is shown.
13. **A component with hosts**: Nuclear Chat knows nothing of the factory. A host (the Builder, Atlas) gives it the
    members, the channels it opens, how a member answers (a responder) and the actions of its buttons; it gives the
    host the user's messages and answers. The UI is a library the hosts' pages mount, in VS Code first.
14. **Slack's shape**: on the left the channels and the direct messages with their unread counts; in the middle
    the messages (avatar, name, the time, the text with markdown and code, GIFs, reactions, the thread's count);
    the thread opens beside it; a composer with `@`, `#`, `/` completion and a GIF button.
15. **English and Spanish** for every text of the component; the members answer in the language the user chose
    (`nuclear.language`), or in the language of the user's message when it is written in another (the user,
    2026-11-18); the language is chosen in the onboarding's first step and the first section of *Settings and
    integrations*.
16. **Made with Synapsis** (2026-11-18, the user): the service is a Synapsis `backend` project, the UI a Synapsis
    `web` project embedded in the editors' pages; both made with the tools (`nuclear new`, `gen`, the transpiler).
    What the framework lacks (real time, being embedded) is added to it first: spec 014.
17. **The chat is a front for any agent** (the user, 2026-11-18): talking to the general agent is like talking to
    Claude in its own app. A dropdown in the conversation's header chooses who answers it: Claude Code, OpenCode,
    Codex, Gemini CLI, an API model (with its model), or the local Nuclear Developer; only what is on this machine
    (an agent's command found, a key in the keyring) is offered, and with nothing configured the local agent is
    chosen. The choice is kept per conversation; the answer arrives as it is written (streamed), with its markdown,
    code and the tools the agent calls, and its cost. The chat only carries the conversation: the agent does the
    work, with the factory's MCP tools (ADR-platform-0009). Money is confirmed twice as anywhere else.


## Out of scope (this version)

- Several users (the company is one person and their teams); calls, files bigger than an image, notifications
  outside the editor.
- The JetBrains window (after VS Code; its roadmap).
- Slack itself: no account, no bridge.
