---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../../../docs/03-adr/0000-template.md, ../../../docs/README.md]
---
# Architecture Decision Records — the language

Why the language, the compiler and the language server are the way they are. The rules themselves are in
`docs/07-reference/`; how the code implements them is in `docs/02-architecture/`. Open an ADR only when its title
answers your question.

- A new decision gets the next number, in the format of the tree's
  [`0000-template.md`](../../../docs/03-adr/0000-template.md), and a row in this table.
- An accepted ADR is never edited: a change is a new ADR, and the old one is marked
  `superseded by ADR-lang-NNNN`.
- Cite one with the project's key: `ADR-lang-0006`.

| ADR | Decision | Status | Date |
|---|---|---|---|
| [0001](0001-principles.md) | One golden rule judges every proposal; Nuclear is modules and functions, not objects; the compiler writes the map of a project | accepted | 2026-11-03 |
| [0002](0002-files-and-lexical-syntax.md) | Files are `.nuc`, blocks are two spaces, words for logic and symbols for arithmetic and bits | accepted | 2026-11-03 |
| [0003](0003-functions-lambdas-and-async.md) | A function is a header plus a block, returns its last line when it declares a type, and awaits with `~` | accepted | 2026-11-03 |
| [0004](0004-variables-types-and-expressions.md) | A variable is an assignment, a block has its own scope, `if` and `match` are values, and there are no records nor `type` | accepted | 2026-11-03 |
| [0005](0005-modules.md) | A module uses its members by name, has no visibility words, is constructed by calling its PascalCase name and inherits from classes the type definitions describe | accepted | 2026-11-03 |
| [0006](0006-results.md) | Errors are values: `Result<E, T>` with the error first, propagated on its own, handled with `.ok()` / `.error()` by what the callback returns | accepted | 2026-11-03 |
| [0007](0007-dialects-and-imports.md) | The transpiler writes the imports from versioned definitions; each dialect has its own reference; a new dialect is created by an agent under written rules | accepted | 2026-11-03 |
| [0008](0008-type-definitions-and-target-packages.md) | The target's libraries are described by versioned type definitions, and any package of the target is added through Nuclear with its definitions generated | accepted | 2026-11-15 |
| [0009](0009-standard-library.md) | Nuclear has its own standard library for its base types, translated by every language dialect | accepted | 2026-11-04 |
| [0010](0010-compiler-helps-editors-and-agents.md) | Every word is documented for the editor, and the compiler corrects what an agent writes by reflex or invents | accepted | 2026-11-03 |
| [0011](0011-debugging-nuc.md) | A `.nuc` is debugged through the target's debugger with a line map, not with aligned output nor a debugger of its own | accepted | 2026-11-03 |
| [0012](0012-lazy-imports.md) | Imports are made lazy by the transpiler where a project asks (`lazy_imports`); `use` stays at the top of a file | accepted | 2026-11-19 |
| [0013](0013-helpers-are-part-of-the-language.md) | The helpers of lodash that serve Nuclear are the language's own: no `use`, and the transpiler writes only the ones a program calls | accepted | 2026-11-22 |

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../docs/03-adr/old-numbers.md).
