---
status: accepted
date: 2026-11-22
deciders: Julian Molina
---
# ADR-platform-0014: Stability and parity: the same Nuclear means the same everywhere, proven by tests, served by every tool

## Context and problem
Before the launch (specs 019 and 020) the user asked for the language and the framework to be made reliable: the
same Nuclear had to compile, run and answer the same in every dialect, and nothing new was to break what worked.
Over 2026-11-21 and 2026-11-22 the user gave the decisions below while that work found about seventy differences
between the targets. They are one frame: a later change is checked against them instead of asking again.

## Decision
1. **The rules of the Nuclear language are not changed** by stability work ("no puedes modificar las reglas del
   lenguaje nuclear hasta ahora, ni intentar modificarlo en lo absoluto"). It fixes bugs and compatibility: a case
   where the same Nuclear behaves differently in a dialect, or does not work.
2. **Every change to the transpiler, a dialect or the library runs every test set first**: the standard library,
   the semantics and the conformance programs, the helpers' check, and for the backend the database check
   (`nuclearlang/docs/05-standards/testing.md`). A feature never breaks another.
3. **Generated code compiles in its target with no warning, is what an expert would write, and prints the same in
   every dialect.** When it does not, the transpiler or the dialect is fixed, never the test nor the `.nuc`.
4. **The helpers of lodash are the language's own**, called with no `use`, and lodash adapts to Nuclear, never the
   reverse ([ADR-lang-0013](../../nuclearlang/docs/03-adr/0013-helpers-are-part-of-the-language.md)).
5. **What a client sees never depends on the dialect.** Where two dialects' frameworks answer differently, the
   runtime converts to one output defined by Nuclear, and what describes an API (its JSON, its OpenAPI document) is
   made from the Nuclear, not from a dialect
   ([ADR-synapsis-0013](../../nuclear-synapsis-framework/docs/03-adr/0013-errors-and-openapi-are-nuclears.md)).
6. **Where the dialects differ and nothing is decided, one mature tool is the rule for all of them.** For the
   migrations of a database it is TypeORM ("toma a typeorm como regla de comportamiento"): the backend platform's
   ADR records each behaviour taken from it.
7. **The MCP server does what an agent needs on a project**, so an agent never needs a terminal for it: the
   migrations (`project_migrate`) and the tests (`project_test`) among them. A tool that changes the user's data
   asks the user first ([the MCP server](../../tools/mcp/AGENTS.md)).
8. **The knowledge base holds every new thing**: each helper, each new feature, and the tests with the cases they
   state, so the chat and the agents can answer about them. A feature is not deployed until its rows exist (root
   rule 15).
9. **The agent releases and publishes** what passes the delivery gate ("tienes permiso de subir la nueva versión de
   todo y publicar"), as root rule 10 says.

## Consequences
- Positive: a question of parity has an answer before it is asked (5 and 6); a change has a fixed list of proofs
  (2 and 3) and of places to reach (7 and 8).
- Negative: a fix in one dialect is not done until the others behave the same and a test holds it in all of them;
  the test sets take minutes, and the database check needs Docker.

## References
- `nuclearlang/examples/conformance/`, `nuclear-synapsis-framework/lodash/`,
  `nuclear-synapsis-framework/platforms/backend/checks/database-check/`, `nuclear-synapsis-framework/eval/thesis/bench/`.
- ADR-lang-0013, ADR-synapsis-0012, ADR-synapsis-0013, ADR-platform-0004 (products are made with the tools).
