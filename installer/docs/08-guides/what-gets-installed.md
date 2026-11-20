---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [installer/docs/03-adr/0006-only-nuclearlang-is-required.md, installer/docs/08-guides/ai-setup.md]
---
# What the installer installs, what is yours to choose, and what it never installs

NuclearLang, the Smart Graph and the MCP server are required and always installed, without a question: they are
what lets your AI agents know Nuclear. The editor extension is added when an editor is there; the local agents are
asked. What could not be added is listed at the end with how to add it.
Running the installer again is safe: what is already there is kept, what is missing is added
([ADR-installer-0006](../03-adr/0006-only-nuclearlang-is-required.md)).

## Required

A missing one ends the install with an error (NuclearLang itself stays installed); run the installer again and it
goes on from there.

| What | Why | Tried on |
|---|---|---|
| NuclearLang: `nuclear`, `nuclear-lsp`, the dialects, the standard library, on your PATH | writes, checks and builds Nuclear for every platform | Linux x86_64, macOS Apple silicon, Windows x64 and ARM64 |
| The Smart Graph, with its own embeddings model (about 300 MB, no Ollama) and the release's vectors, started at every login | what agents know of NuclearLang, searched by meaning | Linux, macOS Apple silicon, Windows x64; Windows ARM64 (the x64 archive) by the release's Windows test |
| The MCP server (`nuclear-mcp`), given to every AI client found: Claude Code, Codex, Grok Build, Cursor, OpenCode, Gemini CLI | the generators, the compiler and the graph, for your agent | Claude Code and Cursor; Grok Build not yet |
| The `nuclear` skill | what Nuclear is, for your agent | Claude Code |

Linux aarch64 and macOS Intel get NuclearLang's own build; neither was tried on a machine yet. **An Intel Mac
cannot complete the install yet**: the Smart Graph's model runtime (onnxruntime) is not published for it, so the
installer installs NuclearLang and says the rest is missing.

## Added when possible (never stops the install)

| What | When | If it is not added | Tried on |
|---|---|---|---|
| The editor extension | an editor of the VS Code family is found: VS Code, Insiders, Cursor, VSCodium, Windsurf | install the editor, then run the installer again; or search *NuclearLang* in its extensions | VS Code and Cursor on Linux and macOS |

## Optional, asked

| What | The question | Tried on |
|---|---|---|
| Local agents: the Nuclear Developer with Ollama's models (profiles `lite`, `medium`, `hard`) | the set-up asks the profile; `remote`, the answer by default, downloads no local model. Declined (the machine, Ollama or the models), it goes on as `remote` | Linux |

## Each platform's own (yours, only for the platforms you build)

None is needed to write, check and build Nuclear. The installer's summary says which are found; the editor's
welcome and *Settings and integrations › Toolchains* ask only for the platforms you choose, with this system's steps.
A toolchain already on the machine is found (its setting, its variable, the PATH, the usual folders, your login
shell's PATH; Flutter also from the Dart extension's `dart.flutterSdkPath`) and never installed twice.

| Platform | Toolchain | How to install it |
|---|---|---|
| Mobile | Flutter | macOS: `xcode-select --install`, then `brew install --cask flutter` or [Flutter's macOS guide](https://docs.flutter.dev/get-started/install/macos); Linux: `sudo snap install flutter --classic` or [Flutter's Linux guide](https://docs.flutter.dev/get-started/install/linux); Windows: [Flutter's Windows guide](https://docs.flutter.dev/get-started/install/windows). Then `flutter doctor` in a new terminal |
| Web, NestJS | Node.js 20+ | macOS: `brew install node` or the LTS of [nodejs.org](https://nodejs.org); Linux: your distribution's `nodejs` or nodejs.org; Windows: `winget install OpenJS.NodeJS.LTS` |
| FastAPI | Python 3.12+ | comes with the AI services; another one: `brew install python@3.12`, your distribution's `python3`, `winget install Python.Python.3.12` |

`nuclear setup flutter|node|python` installs NuclearLang's own on Linux and macOS (the editor offers it as a second
choice). Tried on a clean machine: Flutter on Linux only. On macOS it waits for Apple's command line tools in the
terminal it runs in: if it stops, install the toolchain with the steps above.

## Never installed (named, with steps, when a platform needs them)

`--no-ai` (`-NoAi`) exists for tests only: it skips the Smart Graph and the MCP server, and the install ends
incomplete.


| What | Needed for | How |
|---|---|---|
| Xcode (App Store) and CocoaPods | iOS apps | the App Store; `sudo gem install cocoapods` or `brew install cocoapods` |
| Android Studio and an Android SDK | Android apps | [developer.android.com/studio](https://developer.android.com/studio), then `flutter doctor --android-licenses` |

## Run it again

- The same version: NuclearLang and the AI services are kept (nothing downloaded), an editor installed since gets
  the extension, the summary is shown again.
- Interrupted (Ctrl+C, a closed terminal, a lost connection): it goes on from the step it reached, a download from
  where it stopped.
- A new version: replaced, with the AI services' profile kept.
- `--reinstall` (`-Reinstall` on Windows): downloads and replaces even what is there.
