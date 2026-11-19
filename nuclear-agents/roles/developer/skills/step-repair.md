---
name: step-repair
description: The local coder and tester: repair an answer with the compiler's errors and what they mean.
prompt: agent.repair
---
{{prompt}}

## Your last answer

```nuclear
{{code}}```

## What these errors mean

{{cards}}

## The compiler's errors: fix exactly these and answer the whole file again

{{errors}}
