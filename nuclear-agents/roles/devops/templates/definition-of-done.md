---
spec: {{id}}
station: delivery
role: devops
by: {{assignee}}
updated: {{date}}
done: {{done}}
---
# Definition of done: {{title}}

| Item | State | Evidence |
|---|---|---|
| Every acceptance criterion is met, QA's verdict is not `fail` | {{criteriaState}} | {{criteriaEvidence}} |
| `nuclear check .` reports no error, every test passes | {{checkState}} | {{checkEvidence}} |
| Every check switched on has a result | {{checksState}} | {{checksEvidence}} |
| The project's documents say what changed; the roadmap holds what is left | {{docsState}} | {{docsEvidence}} |
| The pull request's body says what, why, how checked and what is left | {{prState}} | {{prEvidence}} |

## What is missing

{{missing}}
