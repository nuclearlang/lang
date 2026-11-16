---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/typescript.md, nestjs.md, react.md, dependencies.md]
---
# The `typescript` dialect: how the base language is written in TypeScript

`typescript` is a language dialect: it extends no other, so it defines every `[syntax]` template. `nodejs` and
`react` extend it; `nestjs` extends `nodejs`. The normative equivalences, construct by construct, are
[../07-reference/typescript.md](../07-reference/typescript.md); this document says where each thing is decided and
why. The meaning of every option and template variable: `nuclear spec` and
[the dialect format](../../../../docs/07-reference/dialects.md).

## Files

| File | Holds |
|---|---|
| `dialect.toml` | `[dialect]` (extension `ts`, indent of 2 spaces; no `defs`: the framework dialects list them), `[options]`, `[syntax]`, `[types]`, `[operators]`, `[names]`, `[functions]`, `[modifiers]` |
| `keywords.toml` | TypeScript's reserved words, each with how Nuclear produces it and a note. Inherited by every dialect that extends this one |
| `library.toml` | one template per member of Nuclear's standard library; a `helper` is written once per file |
| `docs.toml` | `[words]`: the editor's text for each header word. Skipped by the loader |
| `templates/result.tpl` | the `Result` runtime written into a file that uses `Result` |
| `templates/doc_comment.tpl` | a doc comment as JSDoc (`@param`, `@returns`, `@throws`, `@example`, `@see`, `@since`, `@deprecated`) |

It defines no kinds and no clauses. Modifiers: `abstract`, `static`, `readonly`, `declare`, `get`, `set` (a setter
never returns).

## Options and what each is for

| Option | Effect in the output |
|---|---|
| `implicit_self = false` | members are written with `this.` |
| `named_args = "object"` | named arguments to a Nuclear function are reordered by position; to an external function they become one object: `f(a, x = 1)` → `f(a, { x: 1 })` |
| `int_member_parens` | `(5).toString(2)`: `5.` would start a decimal |
| `cascade_statements` | `paint = Paint()` + `..color = x` → `const paint = new Paint(); paint.color = x;`; inside an expression, `(($) => { $.color = x; return $; })(new Paint())` |
| `string_quote = "'"`, `interp_quote = "\`"`, `dollar_escape = "before_brace"` | text in single quotes; with interpolation, backticks |
| `reserved_escape = "suffix"` | a Nuclear name that is a TypeScript word gets a suffix |
| `max_bases = 1` | a single base class; interfaces go with `>` or are detected |
| `catch_var = "error"` | the variable of a `catch` without a name |

## Declarations

- `export` before functions, classes, interfaces and enums.
- A name that is not reassigned is `const`; one that is, `let`.
- `PascalCase(...)` of a class is `new Name(...)`; `String`, `Number`, `Boolean`, `Symbol` and `BigInt` are called
  without `new` (`[names] not_constructors`).
- Constructor parameters are `public` constructor parameters; an attribute without a value nor `?` is
  `name!: string`.
- A function with `~` is `async` and returns `Promise<T>`; with `yield`, `function*` and `Generator<T>`
  (`AsyncGenerator<T>` with both).
- A method that overrides one of a base class of the file gets `override`.
- An inheriting module's constructor calls `super(...)` first; without one written, `super();`.

## Expressions that are not one-to-one

| Nuclear | TypeScript | Why |
|---|---|---|
| `a == b` / `a != b` | `a === b` / `a !== b`; with `null` on a side, `a == null` / `a != null` | `null` is "no value": the loose form also covers `undefined` (an optional property, a missing argument) |
| `x is T` | `x instanceof T`; `typeof x === 'string'`, `Number.isInteger(x)` for `int`, `Array.isArray(x)` for a list | basic types have no class at run time |
| `a in b` | `b.includes(a)` for a list; `a in b` for a map literal or `<K, V>`; `b.has(a)` for a `Map` or a `Set` | |
| `a ~/ b` | `Math.trunc(a / b)` | |
| `a ** b` | `a ** b`, parenthesized under unary minus | |
| a bitwise operand of a comparison | gets parentheses | TypeScript binds `==` tighter |
| range `a..b` as a value | `Array.from({ length: b - a }, (_, i) => a + i)` | |
| `for k, v in m` | `Object.entries(m)`; a `Map` object is iterated directly | maps `<K, V>` are plain objects (`Record<K, V>`) |
| `[a, if cond b]` | `[a, ...(cond ? [b] : [])]` | |
| `T?` | `T \| null` | |
| `print(x)`, `now()` | `console.log(x)`, `new Date()` | |
| `delay(ms)`, `awaitAll(xs)` | a `setTimeout` promise, `Promise.all(xs)` | |

`int`, `double` and `number` are all `number`; `any`, `dynamic` and `unknown` are `any`; `DateTime` is `Date`,
`Duration` a number of milliseconds, `Bytes` a `Uint8Array`, `Regex` a `RegExp`, `Match` a `RegExpMatchArray`.

## `Result`

`Result<E, T>`, `Ok` and `Err` are the file's own runtime, `templates/result.tpl` (`result_runtime`): a class with
`isOk`, `isErr`, `value`, `error`, `andThen`, `inspect`, `orElse`, `inspectErr`, `map`, `getOrElse`. Propagation is
`if (r.isErr) return Err(r.error);`. A dialect that extends this one and has a runtime sets
`builtin_result = false` and imports `Result` from it (`nestjs`, `react`).

## Imports and names

- `use fs/promises{ readFile }` → `import { readFile } from 'fs/promises';`; `use * as path from path` →
  `import * as path from 'path';`; `use './setup'` → `import './setup';`.
- Another file of a project is a relative import (`project_import = "{{relative}}"`: `./data/task`,
  `../shared/user`). `nestjs` replaces it to end in `.js`.
- `[names] globals`: the names of the environment that exist without declaring or importing them (`console`,
  `JSON`, `Math`, `Date`, `Promise`, `Map`, `Set`, `fetch`, `setTimeout`, `structuredClone`, `parseInt`...).
- This dialect lists no type definitions; `nestjs` and `react` add `typescript@5.9.3` (the standard library,
  implicit) and their packages ([dependencies.md](dependencies.md)).

## The standard library

`library.toml` writes [Nuclear's library](../../../../docs/07-reference/library.md) with TypeScript's: lists are
arrays, maps `<K, V>` are plain objects (`Object.keys`), sets are `Set`. `DateTime`'s parts are read in UTC (`Date`
has no UTC flag). A `Regex` is a `RegExp` with the `g` flag, so `matchAll` and `replaceAll` work, and `test`, `find`
and `findAll` never depend on `lastIndex`. `Error(message)` is `new Error(message)` and `e.message` is
`(e as Error).message`. Members without a one-line form are helpers written once per file (`_toInt`, `_remove`,
`_min`, `_sortBy`, `_groupBy`, `_round`: half away from zero, `_replaceWith`: a callback with a `Match`). The full
account: [../07-reference/typescript.md](../07-reference/typescript.md) §5.
