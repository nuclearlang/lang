---
name: step-security
description: The local security reviewer: the findings of a piece of code, one line each.
prompt: agent.security
---
{{guide}}

## Rules of the platform

{{knowledge}}

## The compiler says

{{check}}

## Code to review

```nuclear
{{code}}
```

## Answer

The findings, one per line:

    severity | line | problem | fix

Answer `none` when there is no finding you can show.
