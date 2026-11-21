---
name: clean-code
description: Keep Nuclear code clean and sustainable: clear names, small functions and kinds with one job, no duplication, no dead code, no abstraction nobody needs, errors as Result, comments only for the why. Use when writing or reviewing any change, and before calling a task done.
title: Clean code
title_es: Código limpio
description_es: Mantener el código Nuclear limpio y sostenible: nombres claros, funciones y piezas pequeñas con una sola tarea, sin duplicación, sin código muerto, sin abstracciones que nadie necesita, errores como Result, comentarios solo para el porqué. Úsalo al escribir o revisar cualquier cambio y antes de dar una tarea por terminada.
kind: practice
tags: [clean code, readability, naming, refactoring, duplication, simplicity, maintainability, yagni]
base: true
---
# Clean code

## When to use

Every change. The platform's golden rule is performance, speed and readability: minimal readable Nuclear. Code is
read far more often than written; the next reader is a person or an agent with no context.

## Steps

1. **Names say what, not how.** camelCase functions and variables, PascalCase kinds; a function is a verb
   (`createOrder`), a value a noun (`total`), a boolean a question (`isPaid`). No abbreviations nobody types.
2. **One job each.** A function does one thing at one level of detail; a use case one business action; a component
   one business area (skill `clean-architecture-components`). A function that needs "and" in its name is two.
3. **Short and flat.** Return early instead of nesting; a long function is split where a name explains the piece.
4. **No duplication.** The second copy of a rule becomes one function in the kind that owns it; standard code comes
   from `nuclear gen` and `nuclear make`, never copied.
5. **No speculation.** No option, wrapper, parameter or layer "for later": add it the day a real case needs it.
   Delete dead code and commented-out code; git keeps the history.
6. **Errors are values.** Use cases return `Result` with the platform's errors (`NotFound`, `Invalid`,
   `Unauthorized`, `Forbidden`, `Conflict`); never a silent catch, never a magic value for "failed".
7. **Comments for the why.** The code says what it does; a comment says why it is so when the code cannot.
8. **Leave it formatted and checked.** `nuclear fmt .`, then `nuclear check .` clean.

## The platform's tools

- `nuclear fmt .` (`--check` in CI), `nuclear check . --json`, `nuclear fix .`.
- `nuclear gen inspect` before writing a part that may already exist.
- Skills `code-review` (the review), `clean-architecture-components` (where each piece lives), `tdd` (tests first).

## Pitfalls

- Clever one-liners a reader has to decode: short is good only when it is also obvious.
- Renaming or reshaping code outside the task: the diff grows and the review loses the change.
- Abstractions that hide one call: a wrapper with one caller is noise.
- Swallowing an error to make a test pass.

## Checklist

- [ ] Names read as what they mean; nothing abbreviated without need.
- [ ] Each function and kind has one job; no deep nesting.
- [ ] No duplicated rule, no dead or commented-out code, no option nobody asked for.
- [ ] Errors are `Result` values with the platform's errors.
- [ ] `nuclear fmt .` and `nuclear check .` leave nothing.
