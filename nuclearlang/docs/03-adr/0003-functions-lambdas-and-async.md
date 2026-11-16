---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0003: A function is a header plus a block, returns its last line when it declares a type, and awaits with `~`

## Context and problem

Functions are most of a program. Every keyword they need (`function`, `return`, `async`, `await`) is a token an
agent pays in every file and a place where two styles appear.

## Decision

**No keyword.** A function is a header plus a block: `greet(x: string) string` followed by an indented body. There
is no `fn`/`def` keyword (the "header + block" rule).

**Implicit return.** The last line is returned only when the function declares a return type. It avoids returning
something by accident from `void` functions.

**Automatic async.** `async` is never written. A function that awaits another (`user = ~callUser()`) becomes async.

**Await with `~`.** `~` before a call awaits it: `users = ~getUsers.get()`. `@` is only for decorators.

**No nested functions.** Functions are not declared inside a body; an anonymous function assigned to a name is used
instead: `log = (message: string)` plus a block.

**One-line lambdas** are kept: `numbers.map(n => n * 2)`.

**Only explicit parameters.** Only the parameters written in the signature exist.

**Parameters between `{ }`** are optional in a signature; only Dart uses them (named parameters). Other dialects
ignore them.

**Generators.** `yield value` and `yield ...other()`; a function with `yield` is a generator (async when it uses
`~`); the return type is the type of each value.

**Function aliases.** `name() = Module.method`: `name` is the same function as `method` (same parameters, return,
async). A non-`static` method is called on a new `Module()`, whose constructor cannot have required parameters
(N0112). Only when the body is `Module.method` of a module of the file; otherwise the one-line form keeps its
meaning.

## Options considered

1. A keyword before the function: rejected.
2. Returning the last line always, or never: rejected.
3. `await`, or `@` before the call: rejected.
4. Inferred parameters: existed and were removed.

## Consequences

- Positive: a function costs its name, its parameters and its body; async can never be forgotten or misplaced; a
  facade is one line per function (`list() = ListTasks.exec`).
- Negative: `~` before a call that is not asynchronous is not reported yet and fails in Python
  (`docs/01-product/roadmap.md`).

## References

- `docs/07-reference/nuclear-base.md` §4.1, §4.1.1, §4.1.2, §6.4; `docs/02-architecture/result.md` (aliases).
- Replaces: ADR-0002, ADR-0005, ADR-0012, ADR-0013, ADR-0019, ADR-0020, ADR-0021, ADR-0023, ADR-0029, ADR-0037
