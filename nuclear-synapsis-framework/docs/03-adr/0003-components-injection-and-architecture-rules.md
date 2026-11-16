---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0003: An app is closed components with layers and a facade; dependencies are injected by header; the transpiler checks the architecture

## Context and problem
The framework writes the architecture so that Nuclear holds only the business logic (ADR-synapsis-0001), and it warns
when something breaks that architecture. That needs one shape for every project: where each declaration lives, how
it gets what it depends on, and who may call whom.

## Decision
**Component structure.** An app is made of components, one per feature:
`components/<c>/{config, data, domain/{models, usecases, aggregates, services}}` plus the platform's entry layer
and the component's facade (kind `appcomponent`); `shared/`, `config/` (kind `appConfig`) and, in an app, `main.nuc`
at the root. The entry layer is `presentation/<screen>/{managers, state_models}` and `presentation/widgets` where
there are screens, and `api/` in a backend. The exact place of each kind's file is data: `[layout]` of the
platform's contract (ADR-synapsis-0002). The layers exist in the generated code, not as ceremony in Nuclear
(ADR-dart-0001).

**Dependency injection.** A typed parameter in a kind's header (`(repository: CharacterRepository)`) is injected
automatically. Nothing is registered or resolved by hand.

**Architecture rules.** A use case is only called from an appcomponent; a service only from a use case or an
aggregate. From another component only its public kinds are visible. The transpiler checks the rules across the
whole project (it is the framework's linter): they are declared in `[architecture]` of the dialect (`scope`,
`public`, `exempt`, `callers`, `names`); a caller of a kind that may not call it is N0301, a use of something that
is not public in another component is N0302.

**Global components.** Kind `component` in `shared/components/`: cross-cutting use cases any declaration can use;
their `@on(Event)` methods run on every event, wherever the user is.

## Options considered
None recorded in the decisions this one replaces.

## Consequences
- Positive: every project has the same shape, so a person, an agent or a generator knows where a file goes
  (`nuclear help layout --dialect <d>`) and what it may use.
- Positive: a breach of the architecture is a build error with a code, not a review comment.
- Negative: every rule is an error; there is no warning level and no way to switch a rule off for a file or a
  declaration (open in `docs/01-product/roadmap.md`).

## References
- Replaces: ADR-0042, ADR-0043, ADR-0046, ADR-0053
