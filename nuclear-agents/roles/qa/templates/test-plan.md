---
spec: {{id}}
station: quality
role: qa
by: {{assignee}}
updated: {{date}}
---
# Test plan: {{title}}

Approve, switch off or add checks in the run's console; the run waits for you. Checks marked `user` are yours to run
and mark.

| Id | Check | Kind | By | How | Passes when | On |
|---|---|---|---|---|---|---|
| {{checkId}} | {{check}} | {{kind}} | {{by}} | {{how}} | {{passes}} | {{on}} |

Kinds: `functional`, `edge`, `security`, `practices`, `performance`, `load`.

## Not checked, and why

- {{notChecked}}
