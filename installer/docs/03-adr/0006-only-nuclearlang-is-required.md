---
status: accepted
date: 2026-11-20
deciders: Julian Molina
---
# ADR-installer-0006: Only NuclearLang is required; the rest is added when it can be; a platform's toolchain is never installed by the installer; a new run keeps what is there

## Context and problem
On a Mac without Flutter the install never finished (2026-11-20): the editor's welcome marked Flutter as required
whatever the user builds (every platform was assumed when none was chosen), and its highlighted button ran
`nuclear setup flutter`, which on macOS waits in a terminal for Apple's tools and gigabytes of downloads. A user
who builds only backends or web apps does not need Flutter at all. Running the installer again downloaded and
replaced everything, and on Windows it failed while the AI services held the installation's files.

## Decision
- **Required** (the install fails without it): NuclearLang itself, its compiler, language server, dialects and
  standard library, with `nuclear` on the PATH. Nothing else is required.
- **Added when possible** (never stops the install; what could not be added is said with how to add it later): the
  extension in every editor of the VS Code family found, the agents' `nuclear` skill, the AI services when the user
  says yes (their archive, their set-up, the MCP server in the AI clients).
- **Each platform's toolchain** (Flutter for mobile, Node.js for web and NestJS, Python for FastAPI) is never
  installed by the installer. The installer's summary says which are found and where to get the rest; the editor
  says it again for the platforms the user chose (or the workspace's projects): a toolchain is needed only for them,
  and none before a choice. Its highlighted action is the user's own install with this system's steps; NuclearLang's
  own (`nuclear setup <toolchain>`) is a secondary choice, offered on Linux and macOS only, and marked where it was
  never tried on a clean machine.
- **Never installed**, only named with steps: Xcode, Android Studio, CocoaPods, Ollama's models unless the set-up's
  profile asks for them.
- **A new run keeps what is there**: the installation and the AI services record their version (`.version`); a run
  of the same version keeps them and downloads nothing, adds what is missing (an editor installed since), and goes on
  from the step an interrupted run reached. `--reinstall` (`-Reinstall`) replaces them. On Windows the services'
  processes are stopped before a folder is replaced.

## Consequences
- Positive: a fresh machine always ends with NuclearLang installed, whatever is missing on it; a backend or web user
  is never asked for Flutter; running the installer again is safe and fast.
- Negative: a mobile user installs Flutter themselves (with the steps shown), unless they choose NuclearLang's own.
