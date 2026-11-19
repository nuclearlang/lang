---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [domain.md, ../02-architecture/overview.md, ../../../docs/04-specs/013-nuclear-chat/requirements.md]
---
# Vision

## The problem
The software factory (spec 011) has teams the user builds, each member with a name and a personality. Its work
was a log read afterwards and two separate chat boxes, one in the Builder and one in Atlas. The user is the head
of the company and wants to work with them as a company works in Slack: talk to a team or to one member, be asked
when something is unclear, polish a spec in a conversation, try a proof of concept, and see each run as it
happens.

## Why each thing exists
- **The workplace, not a prompt box.** A factory is people working together. The chat makes the work a
  conversation the user takes part in.
- **Talk to who does the work.** A question about the tests goes to the team's QA by name. That member answers as
  their role and through their provider, with what they did in front of them.
- **The tech lead answers for the team.** A message to the team (its channel, `@<team>`, a run's thread) goes to
  its tech lead, who brings in a member when the question is theirs. A direct message or `@<member>` goes to that
  member.
- **They ask, they do not guess.** A member that does not understand asks in the chat. The answer goes back to the
  work (a responder's `ask`).
- **Character makes it readable.** A member speaks as their profile, so who said what is clear at a glance. A GIF
  now and then says a failure or a success faster than a paragraph; it comes by their personality, never at random
  on a re-read.
- **Local and private by default.** The history stays in the project. Nothing leaves the machine unless the user
  turns on a GIF service (asked once) or puts a paid provider on a member (confirmed twice, by the responder).
- **One chat for every tool.** The Builder and Atlas are hosts of the same component; neither keeps its own.
- **Nothing is lost.** A channel's file only grows. A crash costs at most the line being written.

## The users
- **The hosts**: Nuclear Builder (teams as channels, a run as a thread, its questions as messages with buttons)
  and Nuclear Atlas (the local assistant as a member).
- **The person** using a host's page, who never sees the service itself.

## What it does not do
- It does not know how a factory runs. A member's answer is the host's command (a responder); a button's action
  is the host's.
- It has one user (the company is one person and their teams): no accounts, calls, notifications outside the
  editor, or files bigger than an image.
- It is not Slack and has no bridge to it.
