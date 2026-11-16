---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [glossary.md, ../02-architecture/overview.md, ../03-adr/README.md]
---
# Vision

## Problem
A `.nuc` file is written in an editor, and what a developer does around it (run the app, debug it, call its API,
give work to the agents) happens there too. The extensions bring the language to each editor and put every Nuclear
feature in one place, so working on a backend and its apps does not need several windows.

## Users
- A developer who writes Nuclear by hand: live diagnostics, completion, hover, go to definition, the generated code
  beside the `.nuc`, run and debug of a project of any platform.
- A developer who works with agents: Nuclear Builder, Nuclear Atlas and their settings, on the developer's machine.

## What each editor has

| | VS Code | Android Studio / IntelliJ | Zed |
|---|---|---|---|
| The language server (diagnostics, completion, hover, rename…) | yes | yes | yes |
| Grammar | TextMate | the same TextMate grammar | a tree-sitter grammar of tokens |
| Chernobyl themes and icons | yes | yes | yes |
| Code metrics | code lens and colors | code lens and markers | the list, as a message |
| The Nuclear workspace (projects and tools as tabs) | yes | tool windows with shortcuts | no (Zed has no views nor keybindings for extensions) |
| Run, hot reload on save, repair of a Synapsis project | yes | yes (the Flutter plugin runs the app) | tasks and ▷ runnables |
| Debugging a `.nuc` | every platform, with mixed stepping | breakpoints, the paused line, error explanations | no |
| The devices inside the editor | the Synapsis device and the web device | no | no |
| HTTP Connections | yes | yes | no |
| Nuclear Builder | yes | yes, through `nuclear-builder` | no |
| Nuclear Atlas, the settings page, the notifications | yes | no | no |

## What it does not do
- It is not the language server: completion, hover, diagnostics and the project rules are
  `nuclearlang/crates/nuclear-lsp`.
- It does not describe a dialect: the kinds, the documentation of each word and where a project's output goes come
  from the dialect and from the project card the server writes.
- No Nuclear Builder for Zed (decided by the user).
- Zed does not allow the device, `.nuc` debugging nor build on save.
