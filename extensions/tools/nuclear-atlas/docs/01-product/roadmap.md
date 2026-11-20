---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../02-architecture/overview.md, ../../../../vscode/docs/01-product/roadmap.md]
---
# Roadmap of Nuclear Atlas

What the assistant answers is the pending work of `nuclear-graph-storage/` and the Builder's general agent
(`nuclear-builder member --role chat`). The local models are on standby (ADR-platform-0013): Atlas is answered by an
external agent or provider.

## Untested

- **Nuclear Atlas as Nuclear Chat's page** (2026-11-18): rendered in headless Brave with a fake bridge answering
  from what the real service said (English and Spanish), and the direct message answered by the real local agent from
  Node; never opened in a running VS Code. A `/task` from the chat driving a real run, and a template put in the
  composer by a click, were not tried.

## Pending

- **Local models on standby, ADR-platform-0013** (2026-11-20): the line "no agent nor provider can answer" and its
  link to the settings were never seen in a running VS Code.

- The sessions of the earlier page (`.nuclear/chat/<id>.json`) are not read any more and are not moved into the chat.

Nuclear Atlas in Android Studio: [the plugin's roadmap](../../../../jetbrains/docs/01-product/roadmap.md).
