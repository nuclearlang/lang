---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [tasks.md, ../011-software-factory/requirements.md, ../022-workspaces-and-mcp/requirements.md]
---
# Spec 023: Teams that work like human development teams — Requirements

**Priority: high** (the user, 2026-11-20). The factory's teams work as human development teams do: a tech lead plans,
explains and assigns; the members do their part by steps and checks (Scrum or the method the user gives the team);
each team follows the instructions its user wrote for it.

## Atlas informs, the tech leads work
1. Nuclear Atlas only informs: it explains Nuclear and the user's project from the knowledge base (hence its name).
   Asked for a task (code, specs, a project), it does not do it: it says to talk to the tech lead of a team, suggests
   the teams that are free (no run in progress), and when there is none it helps create one in the same chat (the
   MCP server's team tools, each change asked first).
2. Nuclear Chat lists only the **tech lead of each team** (and Atlas), not every member. A tech lead, given a task,
   says first what it will do, how, and who of its team will do each part, then does it through the Builder (specs,
   runs), and reports as the run goes.
3. A team has its method and instructions: Scrum by default (a backlog of specs, a sprint of runs, a review), or the
   method and the instructions the user wrote for that team; the tech lead and every member follow them.

## Less friction
4. The spending confirmation is asked only for work paid by use through an API key (kind `api`); an agent's
   subscription (Claude Code, Codex, Cursor…) is not asked. `forceConfirm` still forces it for everything.
5. A team has a model for all its members (its provider and model, chosen once); a member may still have its own,
   which wins.

## Explained
6. The knowledge base and Atlas explain why to work with a team: it does not cost more tokens; it organizes the work
   in stations (analysis, design, tests first, code, quality, delivery) with checks between them, the way a
   professional team works; the user customizes each team. Agents can explain it in these words.

## A channel is a memory
8. Talking in a team's channel is talking to its tech lead (the user, 2026-11-20: "it must have the same
   functionality if I talk in the team's channel: I can make requirements there and the tech lead answers me there
   without problems, even if I talk in other teams"): the same prompt, tools, spending and reports as its direct
   message; another team's channel is that team's lead, with its own team, method and instructions. And "each
   channel becomes a saved context that serves as internal, separate memory, so there is a context of each thing":
   every channel, every thread of one and every direct message keeps a durable memory of what happened there, read
   only there, which the user can see and clear.

## Local first
9. Every asset a page needs (scripts, styles, images, fonts, themes, binaries) comes with the extension; no page loads
   anything from the internet. If a bundled asset is missing (a broken install), the extension says so and, as a
   contingency, takes it from the release of its own version on GitHub (nuclearlang/nuclearlang), checked against the
   release's checksum, kept in its storage.
