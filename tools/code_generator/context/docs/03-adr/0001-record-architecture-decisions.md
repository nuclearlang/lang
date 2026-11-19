---
status: accepted
date: {{date}}
deciders: TODO(user)
---
# ADR-0001: Record architecture decisions with ADRs

## Context and problem

Technical decisions are lost with time, and neither new people nor AI agents know why the system is as it is.

## Decision

Every structural decision is an ADR in `docs/03-adr/`, in the MADR format, numbered and versioned with the code.

## Consequences

- Good: the context of each decision is there for people and agents.
- Bad: it takes the discipline of writing an ADR for each decision that matters.
