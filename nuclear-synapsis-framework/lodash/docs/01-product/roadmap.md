---
status: accepted
owner: Julian Molina
updated: 2026-11-21
related: [../07-reference/functions.md, ../../../../nuclearlang/docs/03-adr/0013-helpers-are-part-of-the-language.md]
---
# Roadmap

The pending work of the library. A done item is deleted.

## Pending

- The editors do not complete nor show the documentation of a helper yet (the language server reads the
  declarations of a file and of its project; the helpers are neither).
- Inside a module that extends a class nothing describes, a helper is not brought (ADR-lang-0013).
- The helpers left out for now, to add when a program asks for them: `deburr`, `flattenDeep` over `any`, `debounce`
  and `throttle` over `~delay`, `intersection` and `zip` of more than two lists (a list of lists).
- `words` does not split a run of capitals nor letters from digits, as lodash does.
- A lambda given for a type parameter that another argument fixes is not inferred by Dart when that argument is a
  function (`memoize(size, (text) => text[0])`): its parameter is written with its type
  (`(text: string) => text[0]`). The compiler writes the type by itself only inside a list of functions.
- `x!` of a missing value throws in Dart and Python and gives `undefined` in TypeScript (the language's roadmap):
  the helpers never rely on it.
