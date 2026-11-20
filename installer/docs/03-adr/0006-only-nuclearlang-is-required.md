---
status: accepted
date: 2026-11-20
deciders: Julian Molina
---
# ADR-installer-0006: NuclearLang, the Smart Graph and the MCP server are required; the extension is added when it can be; the local agents are asked; a platform's toolchain is never installed by the installer; a new run keeps what is there

## Context and problem
On a Mac without Flutter the install never finished (2026-11-20): the editor's welcome marked Flutter as required
whatever the user builds (every platform was assumed when none was chosen), and its highlighted button ran
`nuclear setup flutter`, which on macOS waits in a terminal for Apple's tools and gigabytes of downloads. A user
who builds only backends or web apps does not need Flutter at all. Running the installer again downloaded and
replaced everything, and on Windows it failed while the AI services held the installation's files.

## Decision
- **Required** (always installed, never asked; a missing one ends the install with an error, NuclearLang itself
  staying installed, and a new run goes on from there): NuclearLang itself (its compiler, language server, dialects
  and standard library, `nuclear` on the PATH); the Smart Graph with its own embeddings model and the release's
  vectors, started at every login; the MCP server, given to every AI client found; the agents' `nuclear` skill.
  `--no-ai` (`-NoAi`) is for tests only: it skips the graph and the MCP server and the install ends incomplete.
- **Added when possible** (never stops the install; what could not be added is said with how to add it later): the
  extension in every editor of the VS Code family found.
- **Optional, asked**: the local agents (the Nuclear Developer with Ollama's models). The set-up asks with `remote`
  as the answer by default, which downloads no local model; a local profile whose machine, Ollama or models are
  declined goes on as `remote`. Without a terminal the profile is `remote`.
- Where the graph's runtime is not published, the install says so and ends incomplete: an Intel Mac (onnxruntime has
  no wheel for it). Windows on ARM runs the x64 archive under its x64 emulation.
- **Each platform's toolchain** (Flutter for mobile, Node.js for web and NestJS, Python for FastAPI) is never
  installed by the installer. The installer's summary says which are found and where to get the rest; the editor
  says it again for the platforms the user chose (or the workspace's projects): a toolchain is needed only for them,
  and none before a choice. Its highlighted action is the user's own install with this system's steps; NuclearLang's
  own (`nuclear setup <toolchain>`) is a secondary choice, offered on Linux and macOS only, and marked where it was
  never tried on a clean machine.
- **Never installed**, only named with steps: Xcode, Android Studio, CocoaPods.
- **A new run keeps what is there**: the installation and the AI services record their version (`.version`); a run
  of the same version keeps them and downloads nothing, adds what is missing (an editor installed since), and goes on
  from the step an interrupted run reached. `--reinstall` (`-Reinstall`) replaces them. On Windows the services'
  processes are stopped before a folder is replaced.

## Consequences
- Positive: every machine has what agents need to know Nuclear (the graph and the MCP server) without a question; a
  backend or web user is never asked for Flutter; running the installer again is safe and fast.
- Negative: about 460 MB more for every install (the AI archive and the graph's model); an Intel Mac cannot complete
  the install until the graph's runtime runs there; a mobile user installs Flutter themselves (with the steps shown),
  unless they choose NuclearLang's own.
