---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../../../docs/01-product/roadmap.md, ../02-architecture/overview.md]
---
# Roadmap of the JetBrains plugin

What is common to the three editors: [the editors' roadmap](../../../docs/01-product/roadmap.md).

## Untested

- **0.52.0 to 0.53.1 in a running IDE** (0.52.1 to 0.53.1 change only the version and the bundled dialects): the
  *HTTP Connections* tool window (a new id since 0.52.0, so the IDE places it again) was only compiled
  (`build.sh`), never opened.
- The plugin (0.52.2) in a running IDE: it is only compiled, against Android Studio 2026.2. Its two tool windows
  included: [*HTTP Connections*](../../../tools/nuclear-http-connections/docs/01-product/roadmap.md) and
  [*Nuclear Builder*](../../../tools/nuclear-builder/docs/01-product/roadmap.md).

## Pending

- **Go to definition of a helper** (`chunk`, `uniqBy`; VS Code has it): the server answers it with a read-only
  document `nuclear-helper:/array.nuc` only to a client that declares `experimental.nuclearHelperSource`. The
  plugin does not declare it yet: F12 on a helper finds nothing, and hover shows the helper's declaration and doc
  comment. Wanted: the capability in the descriptor's client capabilities, and `findFileByUri` of
  `NuclearLspServerDescriptor` answering the scheme with a read-only `LightVirtualFile` of the `.nuc` file type
  whose text comes from `nuclear/helperSource`; it needs a running IDE to prove it.

- **The Nuclear workspaces** (spec 022, VS Code has them since 2026-11-20): the recent workspaces kept by the IDE (not
  by its project), the workspace's apps (`nuclear workspace show --json`) as the projects the tool windows act on,
  refreshed when `.workspace/workspace.nuc` changes, the empty state (why, the recent ones, open, create), the actions
  *Create a Workspace*, *Open a Workspace*, *Add / Remove / Rename an App* over `nuclear workspace … --json`, and the
  welcome's three steps with *Do it with me by chat* (needs Nuclear Atlas in the plugin).
- Mixed debugging in Android Studio (stepping by Nuclear line; VS Code has it).
- **The language button** (spec 011, req. 18, T5.13): VS Code has `nuclear.language` (automatic, English, Español)
  and a globe in every page and the status bar; the plugin is in English only, with no setting and no button. It
  needs the same setting (a project-independent application setting), a status bar widget and the menu in its tool
  windows, the Spanish of its texts, and `--lang` on its engine calls.
- Nuclear Atlas, the settings page and the notifications are in VS Code only; Nuclear Builder's tool window has no
  diagram, avatars nor checks' console, and no settings of its own for the money (it always asks twice): VS Code's
  page has them (spec 011 T4.7).
- **The Builder's workbench is VS Code's only for now** (spec 011 T4.9, T4.10): the tool window has no specs' tree by
  component and layer (it lists the flat `specs/*/spec.md` and its *New Spec* writes `specs/<id>/`: it should write
  through `nuclear-builder spec new` and list with `spec list --json`), no runs' accordion and no chat (`nuclear-builder
  chat --events`).
- **Spec 023 in the tool window** (2026-11-20): VS Code asks the spending only for an API paid by use (an agent's
  subscription is answered yes unless `forceConfirm`); the tool window still asks for every paid provider when the
  engine asks. It has no team view, so no model for the whole team, method or instructions (the command and the MCP
  server set them: `nuclear-builder team update --kind --provider --model --method --instructions`).
