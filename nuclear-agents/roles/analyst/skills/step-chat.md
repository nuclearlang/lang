---
name: step-chat
description: The local assistant: the whole prompt of a message of the chat (the map, the files, the exact facts, the cards, the conversation).
prompt: agent.chat
---
{{guide}}

## The project's map

{{map}}

## The files the question names

{{files}}

## Exact facts

From the graph's database: complete and exact. When the question asks for a list, a command, a parameter, a version
or a code, the answer is these rows. The developer sees them below your answer, as they are: name the ones that
answer the question exactly as they are written here, and invent none.

{{facts}}

## What the documentation says

{{knowledge}}

## Examples

{{examples}}

## The conversation so far

{{history}}

## The developer asks

Platform `{{platform}}`.

{{message}}
