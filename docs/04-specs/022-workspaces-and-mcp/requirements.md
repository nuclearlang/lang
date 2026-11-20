---
status: approved
priority: high
owner: Julian Molina
updated: 2026-11-20
related: [design.md, tasks.md, mcp-coverage.md]
---
# Spec 022: Workspaces, an agent that does everything through the MCP server, and an onboarding by chat — Requirements

**Priority: high** (the user, 2026-11-20).

## The workspace (the user's words)
A workspace is a folder that organizes one business project and the apps that form it, so NuclearLang has a clean
place to work instead of searching projects inside a folder full of projects in other languages. The editor, the MCP
server and the agents recognize it by a marker inside it that says what it is and which apps form it.

```
citofony/                      (the workspace)
  .workspace/workspace.nuc     (the marker: the workspace and its apps)
  citofony-client/             (mobile)
  citofony-guards/             (mobile)
  citofony-web/                (web)
  citofony-caller-service/     (backend)
  citofony-api/                (backend)
```

1. `nuclear workspace new <path> [--name <name>]` makes the folder and its marker; the user only chooses where.
2. An app is added to a workspace (`nuclear workspace add <app> --platform mobile|web|backend [--dialect …]`), made
   by `nuclear new` inside it and written into the marker; removed (the marker; its folder deleted only when asked),
   renamed; listed (`--json`). `nuclear new` run inside a workspace adds the app to it.
3. The marker is Nuclear (`.workspace/workspace.nuc`): its name, description and apps (folder, platform), read by the
   compiler's parser as `config.nuc` is (the parser does not change).
4. The editor opens a workspace (the folder, or one of the recent ones) and shows its apps; it never loses them when
   VS Code's open folder changes: the workspaces are remembered by the editor (recent list), not by VS Code's folder.
   When the editor opens with no workspace, it says why (the open folder is not a workspace) and offers the recent
   workspaces, *Open a workspace…* and *Create a workspace*.
5. The onboarding: (1) create the workspace (its path and name; it explains the marker and that the apps are linked
   to it), (2) add one or several apps, (3) a short tour of each tool. Every step offers *Do it with me by chat*: Atlas
   opens and the user's agent does it through the MCP server, asking before each change.

## The MCP server: everything an agent needs
6. Workspaces: create, list, show, rename/edit, delete; apps: add, list, rename, remove. **Every change asks the
   user's confirmation** (MCP elicitation; a client without it gets a preview and must call again with the
   confirmation token the preview gave).
7. Specs: create (and list, show, edit) a spec of a project, written where Nuclear Builder reads them, so it appears in
   the Builder at once.
8. Teams and members: create, edit, delete teams; add, edit, remove members; skills; all confirmed.
9. A list of what the tools can do that an agent still cannot do through the MCP server (`mcp-coverage.md`), kept
   current.

## The tutorial
10. The tutorial and the guides start from a workspace and do the work by chat with the agent; each tool has a short
    "how it works" in the tour.
