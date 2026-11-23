---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../02-architecture/overview.md, ../../../nuclear-builder/docs/08-guides/README.md, ../../../../vscode/docs/08-guides/workspace.md, ../../../../../installer/docs/08-guides/ai-setup.md]
---
# Nuclear Atlas

**Nuclear Atlas** is your direct message with the general agent of the factory in Nuclear Chat: ask about your
project, or give an order, answered by the agent or provider you pick over the Nuclear Smart Graph. It is the tool **Nuclear
Atlas** of the Nuclear workspace (`Ctrl+Alt+A`), in VS Code only, on the last project you were in.

TODO(human): Nuclear Atlas was never opened in a running VS Code. Check this guide against it once.

## What it needs

The AI services of *Nuclear: Set Up the AI Services* ([Set up the AI services](../../../../../installer/docs/08-guides/ai-setup.md)):
Nuclear Chat (the service `nuclear-chat`) and the Smart Graph, and an agent or a provider to answer. When the chat
does not answer, the page says so and how to fix it (`nuclear-builder setup`). Who answers is the setting
`nuclear.builder.chat`: Claude Code's agent by default, or Codex, Gemini CLI, Cursor, OpenCode, Grok Build, or a
model through an API with its key in the vault; an API paid by use asks twice before it spends (an agent's subscription does not, unless `nuclear.spending.forceConfirm`). When none of them can
answer on this machine, a line over the chat says so, and its link opens Settings and integrations → Nuclear
Builder to pick one. The local models are on standby (ADR-platform-0013).

## Ask

Atlas informs: it explains Nuclear and your project from the knowledge base. For work (code, specs, a project) it
sends you to a team's tech lead, says which teams are free, and helps you make one when there is none; the page's
hint says so. Nuclear Chat lists Atlas and each team's tech lead. Its channels and direct messages are in the
workspace's column, beside the page: a click opens that conversation in the page. Atlas reopens on the conversation
you were in last in that folder, also after VS Code restarts.

Write in the chat and press Enter (Shift+Enter is a new line). Atlas answers there. It is the same conversation as
*Atlas* in the Builder's chat, and it stays in the project (`.nuclear/chat/`).

## Tasks go to a tech lead

Atlas does not run tasks. Ask it for one and it tells you which tech lead to ask and which teams are free; `/task …`
gets the same answer, with each tech lead as a link to their conversation. The tech lead plans the work with you and
runs it through the Builder: [Nuclear Builder](../../../nuclear-builder/docs/08-guides/README.md).

## Templates

The buttons on top are built from your project's own components, use cases and controllers or screens: a click
puts the text in the chat's composer, with its `…` selected for you to fill. They ask Atlas to explain (a component,
a use case, where data comes from, security, the platform's kinds), *Who can do a task?* (which tech lead to ask,
which teams are free) and *Why work with a team?*; none orders work.
