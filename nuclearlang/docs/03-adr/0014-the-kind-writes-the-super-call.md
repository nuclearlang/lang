---
status: accepted
date: 2026-11-23
deciders: Julian Molina
---
# ADR-lang-0014: The transpiler writes the call to an overridden method the definitions require

## Context and problem

Some classes of a target require every override of a method to call the method it overrides: Flutter's
`State.initState` and `State.dispose` are annotated `@mustCallSuper`, and an override that does not call them is a
warning of the Dart analyzer (`must_call_super`). A `stateful` of Nuclear declares `initState() void` and its body;
the reference asked the user to write `super.initState()` first. A user forgot it in a real app
(2026-11-23): `nuclear check` said nothing and the generated code had a warning of its target, against two promises
of Nuclear (diagnostics before the target's checker; generated code with no warning).

## Decision

**The kind writes the call, not the user** (the user's decision, 2026-11-23: a `stateful` exists so that the user does
not write what its target requires). The type definitions record, per method, that an override must call it and
where (`must_call_super`: `first` or `last`, generated from the target's own annotation and documentation). When a
method of a declaration overrides one so marked in its chain (its bases, its mixins, the classes its kind inherits),
the emitter adds `super.<name>(<its parameters>)`. **The position is data of the dialect**: after the method's
statements for the teardown methods its `[options] super_call_last` names (the dart language: `dispose`,
`deactivate`, `close`, `unmount`, `detach`; teardown frees the subclass's resources, then the parent's; in a method
that returns a value, that call is the value returned: `return super.close()`), before them for every other one. The
definitions' own position, read from the documentation's wording, is only a fallback for a method the list does not
name. A body that already calls it is left as written. No diagnostic: omitting it is the way
to write it.

## Options considered

1. The transpiler writes the call from the definitions (chosen).
2. A diagnostic with a fix that inserts the call (proposed the same day): the user would keep writing a line only the
   target needs, in every `stateful`.
3. The kind's template always writes `super.initState()`: a case of one target and one method in a template, and a
   second call when the user wrote one.

## Consequences

- Positive: the same `.nuc` for every dialect of the platform, with no target line in it; the generated code has no
  `must_call_super` warning; it comes from the definitions, so it covers every marked method of every package.
- Negative: a teardown method outside the dialect's list gets the call first unless its documentation says it ends
  with it; the list is extended when one is found.

## References

- The format: `docs/07-reference/definitions.md` §3.2 and §4; the generator: `tools/defs/README.md`; the code:
  `docs/02-architecture/type-definitions.md`; the reference: `dialects/dart/docs/07-reference/flutter.md` §5.2.
