---
status: accepted
owner: Julian Molina
updated: 2026-11-21
related: [../07-reference/functions.md]
---
# Roadmap

The pending work of the library. A done item is deleted.

## To decide with the user

- **How a project takes the library.** Today it is a project of its own, built and tested for every dialect by
  `check.sh`; a Synapsis project cannot add it yet. Nuclear has no way for one project to use a library written in
  Nuclear (only kind packages and the type definitions of a target's packages). Asked on 2026-11-21, the answer was
  that the library is written in Nuclear and the transpiler writes it for each dialect; which tool brings its
  `.nuc` files into a project (a form of `nuclear add`, or the installer) was not decided.

## Pending

- The helpers left out for now, to add when a program asks for them: `deburr`, `flattenDeep` over `any`, `debounce`
  and `throttle` over `~delay`, `intersection` and `zip` of more than two lists (a list of lists).
- `words` does not split a run of capitals nor letters from digits, as lodash does.
- A lambda given for a type parameter that another argument fixes is not inferred by Dart when that argument is a
  function (`memoize(size, (text) => text[0])`): its parameter is written with its type
  (`(text: string) => text[0]`). The compiler writes the type by itself only inside a list of functions.
- `x!` of a missing value throws in Dart and Python and gives `undefined` in TypeScript (the language's roadmap):
  the helpers never rely on it.
