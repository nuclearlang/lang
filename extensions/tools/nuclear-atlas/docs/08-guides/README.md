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
model through an API with its key in the vault; a paid provider asks twice before it spends. When none of them can
answer on this machine, a line over the chat says so, and its link opens Settings and integrations → Nuclear
Builder to pick one. The local models are on standby (ADR-platform-0013).

## Ask

Write in the chat and press Enter (Shift+Enter is a new line). Atlas answers there. It is the same conversation as
*Atlas* in the Builder's chat, and it stays in the project (`.nuclear/chat/`).

## Give an order: `/task`

`/task <what to do>`, for example `/task Add a screen that lists the orders`. The order runs as a Nuclear Builder
run with your project's team; its members tell each station in the team's channel, as a thread, and ask there with
buttons (a gate, QA's plan). Atlas answers in your order's thread where it went and how it ended. An order that starts
with "fix" becomes a bug; any other is a feature. How a run works:
[Nuclear Builder](../../../nuclear-builder/docs/08-guides/README.md).

## Templates

The buttons on top are built from your project's own components, use cases and controllers or screens: a click
puts the text in the chat's composer, with its `…` selected for you to fill.
