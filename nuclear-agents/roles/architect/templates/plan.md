---
spec: {{id}}
station: design
role: architect
by: {{assignee}}
updated: {{date}}
---
# Plan: {{title}}

## 1. The generators

What the tools write, in this order (`nuclear gen inspect` first):

```sh
{{generatorCalls}}
```

## 2. The pieces

In the order they are written; a piece uses only the pieces above it.

| # | Path | Kind | Declares | Uses | Criterion |
|---|---|---|---|---|---|
| 1 | {{path}} | {{kind}} | {{declares}} | {{uses}} | {{criterion}} |

## 3. The tests first

The tests the Developer writes before the code, one or more per criterion:

| Criterion | Test file | Test |
|---|---|---|
| {{criterion}} | {{testFile}} | {{test}} |
