---
status: accepted
owner: Julian Molina
updated: 2026-11-19
related: [emitter.md, ../03-adr/0006-results.md, ../03-adr/0003-functions-lambdas-and-async.md]
---
# Result and aliases

Read this when you touch `Result<E, T>`, `Ok`/`Err`, propagation, `.ok()` / `.error()`, or function aliases.

## Result<E, T>

Rules: `docs/07-reference/nuclear-base.md` §3.2. Decision: ADR-lang-0006. Error first, like `Either`. No parser or
AST changes (`Ok(x) ->` already parsed as a value pattern). All of it lives in `emit.rs`, section "Result":

- `result_info` knows which calls give a Result (functions/methods of the file with that return, via
  `DeclInfo.sig`/`method_sigs`; variable types in `Frame.types`).
- `FnCtx` says whether the function returns Result (propagates) and whether its last line keeps it.
- `propagate` writes into `pending` the lines `const xResult = ...;` + `result_propagate`; `with_pending`
  puts them before each statement. `hoist_blocked` forbids propagating in lazy branches (N0110).
- `keep_next` keeps a Result (typed variable, return, match subject, Result parameter).
- `.ok/.error` → templates `result_then/tap/recover/tap_error` per `callback_returns_result`.
- Runtime: the optional template `result_runtime` (`dialects/typescript/templates/result.tpl`), written after the
  imports if `uses_result`. Dart has none: fpdart (`[types] Result = "Either"`, `Right`/`Left` via
  `[names] written` + `[auto_imports]`; `result_value` = `(r as Right<E, T>).value` with `result_types`).
- A file that declares Result/Ok/Err sets `result_builtin = false`. Diagnostics N0108–N0111.

- A Result is always handled (N0108 names the ways: `.error(...)`, `match`, propagation). `method_sig` follows
  `DeclInfo.aliases` through `sig_of_method`, so an appcomponent's alias (`ws = workspaces.workspace(id)`, its
  target in another file) propagates like the method it names.
- `~` awaits the whole chain after it: `~f().error(...)` is N0111 with the fix `(~f()).error(...)`
  (`result_needs_await` with the method's name).

Limits: Result only propagates through functions/methods written in Nuclear with a Result return (not
external libraries nor methods of external bases, except those the type definitions mark in `ClassDef.results`).

## Aliases

Rules: `docs/07-reference/nuclear-base.md` §4.1.2. Decision: ADR-lang-0003.

`f() = Module.method` with empty `()`, no return type, and `Module` of the file with that method.
`alias::expand` (called in `lib.rs::transpile`, before the emitter) rewrites it in the AST as
`f(params of method) ret = Module().method(params)` (`~` if async, `yield ...` if generator, `Module.method` if
`static`; `{}` params passed by name). So `collect`, Result and async know nothing about aliases. A
constructor with required params → N0112. With `alias_via = "constructor"` the target modules become constructor
parameters ([emitter-options.md](emitter-options.md)).
