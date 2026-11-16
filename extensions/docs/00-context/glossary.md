---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [vision.md, ../03-adr/0002-the-nuclear-workspace.md]
---
# Glossary

The words of the editors, as the code and the documents use them.

| Term | Meaning | Where it is in the code |
|---|---|---|
| Base extension | The "NuclearLang" extension of an editor: the language for any dialect (ADR-extensions-0001) | `vscode/`, `jetbrains/`, `zed/` |
| Framework extension | An extension with a framework's tools (run, debug, devices, hot reload); none exists yet | — |
| Client | The part of an extension that starts the language server and talks LSP to it | `vscode/src/extension.ts`, `NuclearLspServerDescriptor.java`, `zed/src/lib.rs` |
| Bundle | The server, every dialect and each platform's contract packed inside a `.vsix` or a plugin zip | `vscode/server/`, `jetbrains/build/dist/nuclearlang/server/` |
| Project card | `.nuclear/project.json`: a project's platform, dialect, output folder and toolchain, written by the server and the CLIs | `vscode/src/card.ts` |
| Contract | `.nuclear/contract.json`: the endpoints of a project, written next to the card | read by `http.ts`, `NuclearHttp.java` |
| Line map | `.nuclear/lines.json` (`.dart_tool/nuclear_lines.json` for a mobile app): generated line ↔ `.nuc` line | `vscode/src/debug.ts`, `NuclearDebug.java` |
| Nuclear workspace | The one activity bar container of VS Code where projects and tools are tabs (ADR-extensions-0002) | `vscode/src/workspace.ts` |
| Strip | The vertical row of tabs of the workspace: projects on top, tools at the bottom | `workspace.ts` |
| Pane | What the workspace view shows beside the strip; it depends on the active tab | `workspace.ts` |
| Tab | A project or a tool of the strip; each is a workspace of its own | `activeKey()`: a project root or `tool:<id>` |
| Tool | A full-screen feature of the strip: `http`, `devices`, `loop`, `designer`, `docs`, `agent`, `settings` | `TOOLS` in `workspace.ts`; `tools/` |
| Template page | The page of a tool that is not built: it says what the tool will do | `ToolPanel` in `workspace.ts` |
| Action | A button of a project's platform in the editor title bar (run, debug, reload, device, build, test, check, api, serve) | `PLATFORM_ACTIONS`, commands `nuclear.action.<id>` |
| Dragonfly device | A mobile app running inside VS Code, like an emulator | `vscode/src/device.ts` |
| Web device | A web app shown beside its code in a headless browser | `webDevice.ts`, `webSession.ts` |
| Park / unpark | Close a device's panel while its app keeps running, and give it a panel again | `DevicePanel.park()` / `unpark()` |
| The Loop | The pipeline tool: a spec goes through its stages, every step says who did it | `tools/nuclear-builder/` |
| Nuclear HTTP | The tool like Bruno or Postman over every project's endpoints | `tools/nuclear-connector/` |
| Nuclear agent | The chat with the local agents | `tools/nuclear-ai-chat/` |
| Notice | A notification of what the local agents did while the user was elsewhere | `vscode/src/notifications.ts` |
| Chernobyl | The theme of the three extensions, with its variant Chernobyl Soft | `vscode/theme/` |
