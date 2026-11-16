# nuclear-documentor

**Not built.** A tool of the editors still to do. No description of it was given.

`TODO(human): what is nuclear-documentor, and what must it do?`

## What exists today
No code. The Nuclear workspace of VS Code has a template tab *AI documenter* (id `docs`, `Ctrl+Alt+M`, `TOOLS` in
`extensions/vscode/src/workspace.ts`): a page that says what that tool will do ("Documentation of the active
project generated from its declarations, contracts and doc comments") and lists as planned a page per component
with its use cases, repositories and screens, the API reference from `.nuclear/openapi.json`, and a model
explaining each declaration on demand.

`TODO(human): is nuclear-documentor that template tab?`

## Rules
- Nothing is built here until its spec exists in `docs/04-specs/` of this folder.
- A tool of the strip is a workspace of its own, full screen, with a shortcut
  ([ADR-extensions-0002](../../docs/03-adr/0002-the-nuclear-workspace.md)).
