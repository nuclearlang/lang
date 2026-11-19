---
spec: {{id}}
station: delivery
role: devops
by: {{assignee}}
updated: {{date}}
---
# Deployment: {{title}}

## Pipeline

The CI file exported from the line (`nuclear-builder export {{ci}}`); the stages it runs:

| Stage | Commands | Result |
|---|---|---|
| {{stage}} | {{commands}} | {{result}} |

## Environments

| Environment | Branch | Deploy command | Who approves |
|---|---|---|---|
| {{environment}} | {{branch}} | {{deploy}} | {{approver}} |

## Variables and secrets

By name only, never their values.

| Name | Read by | Set in |
|---|---|---|
| {{name}} | {{readBy}} | {{setIn}} |

## Monitoring

{{monitoring}}

## Rollback

{{rollback}}
