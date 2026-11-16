---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-website-0003: A library of the target comes through `nuclear add`; the site stays 100% Nuclear

## Context and problem
The site should look and move better than a plain documentation page, and it is the place to prove that any
library of a dialect can be used, tested and built from Nuclear. The web platform has no animation words, and
writing TypeScript by hand would break both the site's promise (written in Nuclear) and
[ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md).

## Decision
1. **Animations come from the npm package `motion`, added with `nuclear add motion`**: it installs the package,
   writes it in `config.nuc` (`dependencies(motion = "^14.14.0")`) and generates its type definitions into `defs/`,
   so the Nuclear calls `animate`, `inView` and `stagger` checked like its own code.
2. **One view moves a page**: `Reveal` wraps the content once it is loaded; blocks of class `rise` come up one after
   the other, blocks of class `reveal` fade in when they scroll into view. Where animations cannot run (the tests,
   an old browser) it catches the error and leaves every block visible; a reader who asks for less motion gets none.
3. **Only the styles are not Nuclear**: `public/styles.css`, a static file the web platform serves as it is (the
   platform has no styling words). Everything else of the app is `.nuc`.

## Options considered
1. `motion` through `nuclear add`, one view that runs it (chosen).
2. CSS animations only: no library to prove, and no scroll-triggered motion without script.
3. React's motion components (`motion.div`): need the `motion/react` entry, which `nuclear add` does not describe
   (it generates the package's main entry).

## Consequences
- Positive: the site is a working example of a target library used from Nuclear; the gaps it found are recorded
  (no DOM globals such as `window` or `document` in the react dialect's definitions; an arrow whose value is not
  `void` cannot be passed where a callback returns `void`, so the call goes through a method).
- Negative: the bundle grows by the library; the type definitions in `defs/` are regenerated when its version changes.

## References
- [ADR-website-0001](0001-the-site-sells-the-idea.md); ADR-lang-0008 (packages of the target in a project).
