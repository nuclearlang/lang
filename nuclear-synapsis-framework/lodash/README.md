# Nuclear's helpers of lodash

[![language](https://github.com/nuclearlang/lang/actions/workflows/language.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/language.yml)

**What it is.** 121 helpers of [lodash](https://lodash.com) over lists, maps, texts, numbers and functions
(`chunk`, `difference`, `uniqBy`, `partition`, `orderBy`, `camelCase`, `pick`, `get`, `merge`, `memoize`...), written
once in Nuclear and transpiled to TypeScript, Dart and Python.

**Why it exists.** Two reasons. A Nuclear program gets the helpers every program ends up writing, the same in every
dialect. And the compiler gets a real library to prove itself on: writing it found more than a dozen places where the same Nuclear
gave another result, or no program at all, in one of the targets; each is fixed in the compiler with its test. It
leaves out on purpose what Nuclear's own library already has and what only means something in JavaScript.

**How we made it.** lodash's behaviour, not its code: each function is written in Nuclear with typed parameters,
and its cases come from lodash's tests and documentation where they apply to Nuclear (226 cases). lodash is
MIT-licensed work of the OpenJS Foundation and its contributors; this library copies none of its source.

**Try it.**

```sh
nuclear-synapsis-framework/lodash/check.sh
# ok    checker typescript ... ok    array typescript (72 cases) ... ok    string python (57 cases)
```

**Where to read next.** [The functions](docs/07-reference/functions.md), [what is pending](docs/01-product/roadmap.md),
[`AGENTS.md`](AGENTS.md) to change it.
