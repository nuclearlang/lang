---
status: draft
owner: TODO(user): who owns this document
updated: {{date}}
related: []
---
# Architecture

{{name}} is a Synapsis project of the `{{platform}}` platform: the business is written in NuclearLang and the
transpiler writes the {{stack}} project in `build/` with the `{{dialect}}` dialect. The same `.nuc` builds with every
dialect of the platform. The platform's architecture and the meaning of each kind: `nuclear help {{platform}}` (MCP
`nuclear_doc`).

## Where each kind of piece goes

The platform's layout (`nuclear help layout --dialect {{dialect}}`); `nuclear make` and `nuclear gen` write each
piece there:

{{layout}}

## Context (C4 level 1)

```mermaid
flowchart LR
  user[User] --> app[{{name}}]
  app --> ext[TODO(user): external services]
```

## Containers (C4 level 2)

| Container | Technology | Responsibility | Folder |
|---|---|---|---|
| {{name}} | NuclearLang → {{stack}} | TODO(user) | `.` |

## Critical flows

TODO(user): a sequence diagram of each flow that matters.

## Quality attributes and how they are reached

| Attribute | Strategy |
|---|---|
| TODO(user) | |

## Known technical debt

- None yet.
