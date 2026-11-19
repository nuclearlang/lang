---
spec: {{id}}
station: design
role: architect
by: {{assignee}}
updated: {{date}}
---
# Design: {{title}}

## The components

| Component | Kind | What it does | Talks to |
|---|---|---|---|
| {{component}} | {{kind}} | {{does}} | {{talksTo}} |

## The data model

| Model or entity | Fields | Rules |
|---|---|---|
| {{model}} | {{fields}} | {{rules}} |

## Diagrams

Context (level 1):

```mermaid
{{contextDiagram}}
```

Containers and components (levels 2 and 3):

```mermaid
{{componentDiagram}}
```

## Decisions

The ADRs this design follows:

- {{adr}}: {{howItIsFollowed}}

Proposed: {{proposedAdrs}}

## Risks

- {{risk}}

The plan: [plan.md](plan.md).
