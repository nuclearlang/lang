---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0005: A log is a readable block by component, and the transpiler writes where it was called

## Context and problem

A log must say at a glance which component wrote it and from which line of the `.nuc` file, for a person and for
an agent that reads the console as text. Finding the caller at run time costs time on every log and gives the
generated file's line, not the source's.

## Decision

`Log.d/i/s/w/e` write a block with a breadcrumb (`component › kind › Class.method`), the time, the message, the
data as JSON and, at the foot, the `.nuc` file and line.

**The transpiler writes the breadcrumb in each call as a constant** (the dialect's `[call_site]`): no cost at run
time and no stack reading.

Each component has a stable pastel color (xterm-256); its `config` changes it with `logColor`. A thick frame and a
level badge use the colors of Bootstrap's dark-mode alerts; the breadcrumb and the data use code colors;
Synapsis's own logs are purple. Only the exact place of an error blinks.

Flutter exceptions use their own format: a double red frame, a `✖ EXCEPTION` bar, the stack in columns with the
app's frames highlighted.

A log is readable without colors (`Log.colors = false`), for people and agents.

## Options considered

1. Reading the stack at run time to find the caller: rejected.
2. The breadcrumb written by the transpiler as a constant: chosen.

## Consequences

- Positive: a log costs no more than its text; its place is the source's, not the generated file's.
- Negative: the call site exists only in a dialect that declares `[call_site]`.

## References

- Behaviour, levels and masking: [runtime.md](../02-architecture/runtime.md), [security.md](../05-standards/security.md).
- Replaces: ADR-0078
