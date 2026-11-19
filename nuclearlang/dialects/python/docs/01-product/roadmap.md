---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../02-architecture/fastapi.md, ../05-standards/testing.md]
---
# Roadmap of the `python` dialect

The pending work of `python` and of its framework dialect `fastapi`: only what is about how the output is written
in Python. A done item is deleted. What is pending of the backend platform itself (its kinds, its runtime
package, its commands) is in that platform's roadmap.

## Untested

- **`fastapi` against real services.** Not run: Postgres (asyncpg), MySQL (aiomysql), Redis, Kafka (`listener` /
  `publish` need a broker), OpenAI, the `Chroma` connection.
- **Python 3.12 and 3.13.** Only 3.14 is installed; the generated code targets 3.12+.

## Pending

- **`fastapi` has no `[toolchain] analyze`.** `nuclear analyze` in a fastapi project answers "the fastapi dialect
  has no toolchain.analyze" (found in `nuclear-agents/nuclear_developer/`). The `AGENTS.md` that
  `nuclear agent init` writes tells every agent to run it after `nuclear check`.
- **A map field of a graph's state gets no default.** `frameworks/fastapi/templates/state_field.tpl` gives one to
  lists, texts, numbers and booleans; the emitter's `tinfo` has no `map` flag. `strategy: <string, string>` in the
  Developer's `PieceState` (`nuclear-agents/nuclear_developer/components/developer/ai/states/piece_state.nuc`) is
  written with `= {}` by hand. Generic fix: `tinfo.map` in `nuclearlang/crates/nuclear-transpile/src/emit.rs` and
  the template, for both backend dialects.
- **Found writing Nuclear Chat's service (spec 013, 2026-11-18):**
  - a controller method named like a route decorator (`post`, `get`) hides the decorator in the class body: the
    module fails to import (`TypeError: post() missing 3 required positional arguments`) and `nuclear check` says
    nothing. Wanted: N-code, or the decorators imported under names no method takes.
- **Logs with call sites for Python.** `fastapi` has no `[call_site]` section (the `flutter` and `react` dialects
  have `[call_site.Log]`).
