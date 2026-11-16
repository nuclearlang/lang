---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../../docs/01-product/roadmap.md, ../02-architecture/overview.md]
---
# Roadmap of the JetBrains plugin

What is common to the three editors: [the editors' roadmap](../../../docs/01-product/roadmap.md).

## Untested

- **0.52.0 in a running IDE**: the *HTTP Connections* tool window (renamed from *Nuclear Connector*, a new id, so
  the IDE forgets its old place) was only compiled (`build.sh`), never opened.
- The plugin (0.52.0) in a running IDE: it is only compiled, against Android Studio 2026.2. Its two tool windows
  included: [*HTTP Connections*](../../../tools/nuclear-http-connections/docs/01-product/roadmap.md) and
  [*Nuclear Builder*](../../../tools/nuclear-builder/docs/01-product/roadmap.md).

## Pending

- Mixed debugging in Android Studio (stepping by Nuclear line; VS Code has it).
- Nuclear Atlas, the settings page, the notifications and the Retry buttons are in VS Code only:
  Android Studio has the Nuclear Builder tool window without them.
