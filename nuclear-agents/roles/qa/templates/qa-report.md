---
spec: {{id}}
station: quality
role: qa
by: {{assignee}}
updated: {{date}}
verdict: {{verdict}}
---
# QA report: {{title}}

Verdict: **{{verdict}}** (`pass`, `pass with findings` or `fail`).

## The checks

| Id | Check | By | Result | Evidence |
|---|---|---|---|---|
| {{checkId}} | {{check}} | {{by}} | {{result}} | {{evidence}} |

## Findings

| Severity | File:line | Problem | How to reproduce | The fix |
|---|---|---|---|---|
| {{severity}} | {{where}} | {{problem}} | {{reproduce}} | {{fix}} |

## Security

{{security}}

## Performance and load

| Measure | Threshold | Measured |
|---|---|---|
| {{measure}} | {{threshold}} | {{measured}} |
