# nuclear-ui-designer

**Not built.** A builder of UI for the mobile platform, inside VS Code.

## What exists today
No code. The Nuclear workspace of VS Code has a template tab *UI designer* (id `designer`, `Ctrl+Alt+D`, `TOOLS`
in `extensions/vscode/src/workspace.ts`): a page that says what the tool will do ("Screens and widgets of a mobile
or web project drawn and edited visually, written back as Nuclear") and lists as planned a canvas of the active
screen built from its `.nuc`, the drag of widgets from the platform's kinds, and two-way editing (the code changes,
the canvas follows).

`TODO(human): the template page says "a mobile or web project"; is the tool for the mobile platform only?`

## Rules
- Nothing is built here until its spec exists in `docs/04-specs/` of this folder.
- A tool of the strip is a workspace of its own, full screen, with a shortcut
  ([ADR-extensions-0002](../../docs/03-adr/0002-the-nuclear-workspace.md)).
