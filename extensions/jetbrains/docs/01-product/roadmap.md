---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [../../../docs/01-product/roadmap.md, ../02-architecture/overview.md]
---
# Roadmap of the JetBrains plugin

What is common to the three editors: [the editors' roadmap](../../../docs/01-product/roadmap.md).

## Untested

- **0.52.0 to 0.53.0 in a running IDE** (0.52.1 to 0.53.0 change only the version and the bundled dialects): the
  *HTTP Connections* tool window (a new id since 0.52.0, so the IDE places it again) was only compiled
  (`build.sh`), never opened.
- The plugin (0.52.2) in a running IDE: it is only compiled, against Android Studio 2026.2. Its two tool windows
  included: [*HTTP Connections*](../../../tools/nuclear-http-connections/docs/01-product/roadmap.md) and
  [*Nuclear Builder*](../../../tools/nuclear-builder/docs/01-product/roadmap.md).

## Pending

- Mixed debugging in Android Studio (stepping by Nuclear line; VS Code has it).
- Nuclear Atlas, the settings page, the notifications and the Retry buttons are in VS Code only:
  Android Studio has the Nuclear Builder tool window without them.
