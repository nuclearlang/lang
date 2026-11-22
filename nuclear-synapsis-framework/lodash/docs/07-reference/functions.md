---
status: accepted
owner: Julian Molina
updated: 2026-11-21
related: [../01-product/roadmap.md]
---
# The functions

The helpers every Nuclear file has without a `use` (ADR-lang-0013), by category, with their signatures. A name is
lodash's unless the text says otherwise. `pathKeys`, `child`, `mapAt` and `fillText` are what the helpers use among
themselves: a program does not call them.

## Lists (`src/array.nuc`)

| Function | What it gives |
|---|---|
| `chunk<T>(xs: T[], size: int) T[][]` | The list split into groups of `size`; the last group holds what is left. |
| `compact<T>(xs: T?[]) T[]` | The values that are not null. |
| `difference<T>(xs: T[], ys: T[]) T[]` | The values of `xs` that are not in `ys`, in order. |
| `differenceBy<T>(xs: T[], ys: T[], key: (x: T) => string) T[]` | `difference` comparing what `key` gives for each value. |
| `differenceWith<T>(xs: T[], ys: T[], same: (a: T, b: T) => boolean) T[]` | `difference` with `same` deciding whether two values are equal. |
| `dropRight<T>(xs: T[], n: int = 1) T[]` | The list without its last `n` values. |
| `dropWhile<T>(xs: T[], test: (x: T) => boolean) T[]` | The list without the first values for which `test` is true. |
| `dropRightWhile<T>(xs: T[], test: (x: T) => boolean) T[]` | The list without the last values for which `test` is true. |
| `takeWhile<T>(xs: T[], test: (x: T) => boolean) T[]` | The first values for which `test` is true. |
| `takeRight<T>(xs: T[], n: int = 1) T[]` | The last `n` values. |
| `takeRightWhile<T>(xs: T[], test: (x: T) => boolean) T[]` | The last values for which `test` is true. |
| `fill<T>(xs: T[], value: T, start: int = 0, end?: int) T[]` | Sets `value` from `start` up to `end` (not included), in place. |
| `findLastIndex<T>(xs: T[], test: (x: T) => boolean) int` | The index of the last value for which `test` is true, or -1. |
| `findLast<T>(xs: T[], test: (x: T) => boolean) T?` | The last value for which `test` is true. |
| `initial<T>(xs: T[]) T[]` | Every value but the last. |
| `tail<T>(xs: T[]) T[]` | Every value but the first. |
| `nth<T>(xs: T[], n: int) T?` | The value at `n`; a negative `n` counts from the end. Null when out of the list. |
| `intersection<T>(xs: T[], ys: T[]) T[]` | The values that are in both lists, once each, in the order of `xs`. |
| `intersectionBy<T>(xs: T[], ys: T[], key: (x: T) => string) T[]` | `intersection` comparing what `key` gives for each value. |
| `intersectionWith<T>(xs: T[], ys: T[], same: (a: T, b: T) => boolean) T[]` | `intersection` with `same` deciding whether two values are equal. |
| `union<T>(xs: T[], ys: T[]) T[]` | The values of both lists, once each, in order. |
| `unionBy<T>(xs: T[], ys: T[], key: (x: T) => string) T[]` | `union` comparing what `key` gives for each value. |
| `unionWith<T>(xs: T[], ys: T[], same: (a: T, b: T) => boolean) T[]` | `union` with `same` deciding whether two values are equal. |
| `uniqBy<T>(xs: T[], key: (x: T) => string) T[]` | The first value of each key, in order. |
| `uniqWith<T>(xs: T[], same: (a: T, b: T) => boolean) T[]` | The values without those `same` says were seen before. |
| `xor<T>(xs: T[], ys: T[]) T[]` | The values that are in only one of the lists, once each. |
| `xorBy<T>(xs: T[], ys: T[], key: (x: T) => string) T[]` | `xor` comparing what `key` gives for each value. |
| `without<T>(xs: T[], values: T[]) T[]` | The list without the given values. |
| `pull<T>(xs: T[], values: T[]) T[]` | Removes the given values from the list, in place. |
| `pullAt<T>(xs: T[], indexes: int[]) T[]` | Removes the values at `indexes` from the list, in place, and gives them in the order asked. |
| `remove<T>(xs: T[], test: (x: T) => boolean) T[]` | Removes the values for which `test` is true from the list, in place, and gives them. |
| `sortedIndex(xs: double[], value: double) int` | The lowest index at which `value` keeps a sorted list of numbers sorted. |
| `sortedLastIndex(xs: double[], value: double) int` | The highest index at which `value` keeps a sorted list of numbers sorted. |
| `sortedIndexBy<T>(xs: T[], value: T, key: (x: T) => double) int` | `sortedIndex` for a list sorted by what `key` gives. |
| `sortedIndexOf(xs: double[], value: double) int` | The index of `value` in a sorted list of numbers, by binary search, or -1. |
| `sortedUniq<T>(xs: T[]) T[]` | A sorted list without its repeated values. |
| `zip<A, B>(xs: A[], ys: B[]) Pair<A, B>[]` | Pairs of the values at the same index; as long as the shorter list. |
| `unzip<A, B>(pairs: Pair<A, B>[]) Pair<A[], B[]>` | The two lists a list of pairs came from. |
| `zipWith<A, B, R>(xs: A[], ys: B[], f: (a: A, b: B) => R) R[]` | What `f` gives for the values at the same index. |
| `zipObject<V>(keys: string[], values: V[]) <string, V>` | A map of each key to the value at its index. |

## Collections (`src/collection.nuc`)

| Function | What it gives |
|---|---|
| `countBy<T>(xs: T[], key: (x: T) => string) <string, int>` | How many values each key has. |
| `keyBy<T>(xs: T[], key: (x: T) => string) <string, T>` | The last value of each key. |
| `partition<T>(xs: T[], test: (x: T) => boolean) Pair<T[], T[]>` | The values for which `test` is true, then those for which it is not. |
| `reject<T>(xs: T[], test: (x: T) => boolean) T[]` | The values for which `test` is not true. |
| `flatMap<T, R>(xs: T[], f: (x: T) => R[]) R[]` | What `f` gives for each value, as one list. |
| `reduceRight<T, R>(xs: T[], initial: R, f: (acc: R, x: T) => R) R` | `reduce` from the last value to the first. |
| `orderBy<T>(xs: T[], keys: ((x: T) => double)[], descending: boolean[] = []) T[]` | The list sorted by several keys, each ascending or descending (`descending[i]` is for `keys[i]`); values with the same keys keep their order. |
| `sample<T>(xs: T[], random: () => double) T?` | One value of the list, chosen by `random` (a number in [0, 1)); null for an empty list. |
| `shuffle<T>(xs: T[], random: () => double) T[]` | The list in a random order (Fisher-Yates), each choice made by `random`. |
| `sampleSize<T>(xs: T[], n: int, random: () => double) T[]` | `n` different values of the list in a random order. |
| `forEachIndexed<T>(xs: T[], f: (x: T, index: int) => void) void` | Calls `f` with each value and its index. |
| `forEachRight<T>(xs: T[], f: (x: T) => void) void` | Calls `f` with each value, from the last to the first. |

## Numbers (`src/math.nuc`)

| Function | What it gives |
|---|---|
| `mean(xs: double[]) double?` | The average; null for an empty list. |
| `meanBy<T>(xs: T[], f: (x: T) => double) double?` | The average of what `f` gives; null for an empty list. |
| `sumBy<T>(xs: T[], f: (x: T) => double) double` | The total of what `f` gives. |
| `maxBy<T>(xs: T[], f: (x: T) => double) T?` | The first value for which `f` gives the most; null for an empty list. |
| `minBy<T>(xs: T[], f: (x: T) => double) T?` | The first value for which `f` gives the least; null for an empty list. |
| `roundTo(n: double, precision: int = 0) double` | `n` rounded to `precision` decimals; a negative precision rounds to tens, hundreds... |
| `floorTo(n: double, precision: int = 0) double` | `n` rounded down to `precision` decimals. |
| `ceilTo(n: double, precision: int = 0) double` | `n` rounded up to `precision` decimals. |
| `inRange(n: double, start: double, end: double) boolean` | Whether `n` is from `start` up to `end` (not included); the bounds may come in any order. |
| `randomInt(lower: int, upper: int, random: () => double) int` | A whole number from `lower` to `upper`, both included, chosen by `random` (a number in [0, 1)). |
| `range(start: int, end: int, step: int = 1) int[]` | The numbers from `start` up to `end` (not included) by `step`; a negative step counts down. |
| `rangeRight(start: int, end: int, step: int = 1) int[]` | `range` from its last number to its first. |

## Texts (`src/string.nuc`)

| Function | What it gives |
|---|---|
| `words(text: string) string[]` | The words of a text: runs of letters and digits, split also where a lower-case letter meets an upper-case one. |
| `capitalize(text: string) string` | The first character in upper case and the rest in lower case. |
| `upperFirst(text: string) string` | The first character in upper case; the rest as it is. |
| `lowerFirst(text: string) string` | The first character in lower case; the rest as it is. |
| `camelCase(text: string) string` | `fooBar`: the words joined, each but the first capitalized. |
| `kebabCase(text: string) string` | `foo-bar`: the words in lower case joined by dashes. |
| `snakeCase(text: string) string` | `foo_bar`: the words in lower case joined by underscores. |
| `startCase(text: string) string` | `Foo Bar`: the words joined by spaces, each with its first character in upper case. |
| `lowerCase(text: string) string` | `foo bar`: the words in lower case joined by spaces. |
| `upperCase(text: string) string` | `FOO BAR`: the words in upper case joined by spaces. |
| `truncate(text: string, length: int = 30, omission: string = "...") string` | The text cut to `length` characters, its end replaced by `omission` when it was longer. |
| `fillText(fill: string, n: int) string` | The first `n` characters of `fill` repeated. |
| `pad(text: string, length: int, fill: string = " ") string` | The text with `fill` on both sides up to `length` characters; the extra character goes to the right. |
| `escape(text: string) string` | The text with `&`, `<`, `>`, `"` and `'` written as HTML entities. |
| `unescape(text: string) string` | The opposite of `escape`. |
| `escapeRegExp(text: string) string` | The text with the characters a regular expression gives a meaning to escaped. |
| `trimChars(text: string, chars: string) string` | The text without the characters of `chars` at its start and its end. |
| `trimCharsStart(text: string, chars: string) string` | The text without the characters of `chars` at its start. |
| `trimCharsEnd(text: string, chars: string) string` | The text without the characters of `chars` at its end. |

## Maps and data (`src/object.nuc`)

| Function | What it gives |
|---|---|
| `pick<V>(m: <string, V>, keys: string[]) <string, V>` | The entries whose key is in `keys`. |
| `omit<V>(m: <string, V>, keys: string[]) <string, V>` | The entries whose key is not in `keys`. |
| `pickBy<V>(m: <string, V>, test: (value: V, key: string) => boolean) <string, V>` | The entries for which `test` is true. |
| `omitBy<V>(m: <string, V>, test: (value: V, key: string) => boolean) <string, V>` | The entries for which `test` is not true. |
| `mapValues<V, R>(m: <string, V>, f: (value: V, key: string) => R) <string, R>` | The same keys with what `f` gives for each value. |
| `mapKeys<V>(m: <string, V>, f: (value: V, key: string) => string) <string, V>` | The same values under the key `f` gives for each. |
| `invert(m: <string, string>) <string, string>` | Each value as the key of its key; a repeated value keeps its last key. |
| `invertBy(m: <string, string>) <string, string[]>` | Each value as the key of the keys that had it. |
| `defaults<V>(m: <string, V>, fallback: <string, V>) <string, V>` | The entries of `m`, and those of `fallback` whose key `m` does not have. |
| `findKey<V>(m: <string, V>, test: (value: V) => boolean) string?` | The first key for whose value `test` is true. |
| `findLastKey<V>(m: <string, V>, test: (value: V) => boolean) string?` | The last key for whose value `test` is true. |
| `toPairs<V>(m: <string, V>) Pair<string, V>[]` | The entries as pairs of key and value. |
| `fromPairs<V>(pairs: Pair<string, V>[]) <string, V>` | A map of the pairs. |
| `pathKeys(path: string) string[]` | The keys of a path: `a.b[0].c` is `a`, `b`, `0`, `c`. |
| `get(data: any, path: string, fallback: any = null) any` | The value at `path` (`"a.b[0].c"`) inside maps and lists; `fallback` when the path leads nowhere. |
| `has(data: any, path: string) boolean` | Whether `path` leads to a value inside maps and lists. |
| `child(data: any, key: string) any` | What a list or a map holds at one key of a path. |
| `mapAt(data: <string, any>, key: string) <string, any>?` | The map at `key` of `data`, or null when `data` holds something else there. |
| `set(data: <string, any>, path: string, value: any) <string, any>` | Sets the value at `path` inside a map, making the maps the path needs, in place. |
| `unset(data: <string, any>, path: string) boolean` | Removes the value at `path` inside a map, in place; whether it was there. |
| `cloneDeep(value: any) any` | A copy of maps and lists and of everything inside them. |
| `merge(target: <string, any>, source: <string, any>) <string, any>` | `source` merged into `target`, in place: a map inside both is merged, anything else of `source` replaces. |

## Functions (`src/function.nuc`)

| Function | What it gives |
|---|---|
| `identity<T>(value: T) T` | The value it is given. |
| `constant<T>(value: T)() => T` | A function that always gives `value`. |
| `negate<T>(test: (x: T) => boolean)(x: T) => boolean` | A function that gives the opposite of `test`. |
| `once<T>(f: () => T)() => T` | A function that calls `f` once and gives that first result ever after. |
| `memoize<A, R>(f: (x: A) => R, key?: (x: A) => string)(x: A) => R` | A function that remembers what `f` gave for each key (`key` names an argument: by default its text). |
| `after<T>(n: int, f: () => T)() => T?` | A function that calls `f` only from its `n`th call on; before, it gives null. |
| `before<T>(n: int, f: () => T)() => T?` | A function that calls `f` while it has been called fewer than `n` times; then it gives the last result. |
| `flip<A, B, R>(f: (a: A, b: B) => R)(b: B, a: A) => R` | `f` with its two parameters swapped. |
| `partial<A, B, R>(f: (a: A, b: B) => R, first: A)(b: B) => R` | `f` with its first parameter given. |
| `partialRight<A, B, R>(f: (a: A, b: B) => R, last: B)(a: A) => R` | `f` with its last parameter given. |
| `curry<A, B, R>(f: (a: A, b: B) => R)(a: A) => (b: B) => R` | `f` of two parameters as two functions of one. |
| `flow<T>(fs: ((x: T) => T)[])(x: T) => T` | The functions applied one after another, the first one first. |
| `flowRight<T>(fs: ((x: T) => T)[])(x: T) => T` | The functions applied one after another, the last one first. |
| `times<T>(n: int, f: (index: int) => T) T[]` | What `f` gives for each number from 0 up to `n` (not included). |
| `attempt<T>(f: () => T, fallback: T) T` | What `f` gives, or `fallback` when it throws. |
| `uniqueIds(prefix: string = "")() => string` | A maker of identifiers: each call gives the prefix and the next number, from 1. |

## What lodash has and Nuclear already had

Not repeated here: it is a member of the language's library (`nuclear help library`).

| lodash | Nuclear |
|---|---|
| `map`, `filter`, `find`, `findIndex`, `reduce`, `some`, `every`, `includes`, `size` | `xs.map(f)`, `xs.filter(f)`, `xs.find(f)`, `xs.findIndex(f)`, `xs.reduce(initial, f)`, `xs.any(f)`, `xs.all(f)`, `x in xs`, `xs.length` |
| `head`, `last`, `take`, `drop`, `slice`, `reverse`, `concat`, `flatten`, `uniq`, `indexOf`, `lastIndexOf`, `join` | `xs.first`, `xs.last`, `xs.take(n)`, `xs.skip(n)`, `xs.slice(a, b)`, `xs.reversed()`, `[...xs, ...ys]`, `xs.flatten()`, `xs.unique()`, `xs.indexOf(x)`, `xs.lastIndexOf(x)`, `xs.join(s)` |
| `groupBy`, `sortBy`, `sum`, `min`, `max`, `clamp`, `round`, `floor`, `ceil` | `xs.groupBy(key)`, `xs.sortedBy(key)`, `xs.sum()`, `xs.min()`, `xs.max()`, `Math.clamp(x, low, high)`, `x.round()`, `x.floor()`, `x.ceil()` |
| `toUpper`, `toLower`, `trim`, `trimStart`, `trimEnd`, `padStart`, `padEnd`, `repeat`, `replace`, `split`, `startsWith`, `endsWith`, `parseInt` | `s.upper()`, `s.lower()`, `s.trim()`, `s.trimStart()`, `s.trimEnd()`, `s.padStart(n, fill)`, `s.padEnd(n, fill)`, `s.repeat(n)`, `s.replace(a, b)`, `s.split(sep)`, `s.startsWith(t)`, `s.endsWith(t)`, `s.toInt()` |
| `keys`, `values`, `assign`, `clone`, `isEqual`, `isEmpty`, `isNil`, `defaultTo`, `add`, `subtract`, `multiply`, `divide` | `m.keys`, `m.values`, `{ ...a, ...b }`, `xs.copy()`, `a == b` (lists, maps and sets by what they hold), `xs.isEmpty`, `x == null`, `x ?? d`, the operators |
| `isString`, `isNumber`, `isArray`, `isBoolean`... | `x is string`, `x is int`, `x is any[]`, `x is boolean` |

## What is written another way

- **Pairs.** Nuclear has no tuples: `zip`, `unzip`, `partition`, `toPairs` and `fromPairs` use `Pair<A, B>`
  (`first`, `second`).
- **Several lists.** No rest parameter: `difference`, `union`, `intersection`, `xor` and `zip` take two lists; more
  are chained.
- **Keys are texts.** `countBy`, `keyBy`, `uniqBy`, `differenceBy`... take a `key` lambda that gives a `string`.
- **Random helpers** (`sample`, `sampleSize`, `shuffle`, `randomInt`) take the source of numbers (`Math.random`
  or a fixed one): a program chooses whether it can be repeated.
- **Names changed** because the lodash name is a member of Nuclear's library with another meaning or the helper
  differs: `roundTo`, `floorTo`, `ceilTo` (`round`, `floor`, `ceil` with a precision), `randomInt` (`random`),
  `trimChars`, `trimCharsStart`, `trimCharsEnd` (`trim` with characters), `uniqueIds` (`uniqueId`, as a maker with
  its own count instead of a count of the whole program), `forEachIndexed` (`forEach` with the index),
  `orderBy(xs, keys, descending)` (a flag per key instead of `"asc"` / `"desc"`).
- **Functions of fixed parameters.** `partial`, `partialRight`, `flip` and `curry` are for a function of two
  parameters, `memoize` and `negate` for one, `once`, `after` and `before` for none: a function of any number of
  parameters has no type in Nuclear.
- **`words`** splits on what is not a letter or a digit and where a lower-case letter meets an upper-case one; it
  does not split a run of capitals (`XMLHttp`) nor letters from digits (`foo2bar`), as lodash does.

## What is not here, and why

| lodash | Why not |
|---|---|
| `bind`, `bindAll`, `bindKey`, `rest`, `spread`, `ary`, `unary`, `wrap`, `overArgs`, `rearg`, `curryRight`, `method`, `methodOf`, `invoke`, `invokeMap`, `over`, `overEvery`, `overSome`, `nthArg`, `iteratee`, `matches`, `matchesProperty`, `property`, `propertyOf`, `conforms`, `cond`, `mixin`, `noConflict`, `runInContext`, `chain`, `tap`, `thru` | They change how a JavaScript function is called (`this`, `arguments`, any number of parameters) or build an iteratee from a text or a pattern: in Nuclear a function has typed parameters and an iteratee is a lambda |
| `isArguments`, `isElement`, `isNative`, `isSymbol`, `isWeakMap`, `isWeakSet`, `isTypedArray`, `isArrayBuffer`, `isBuffer`, `isPlainObject`, `isObjectLike`, `isFunction`, `isLength`, `isSafeInteger`, `isNaN`, `isFinite`, `isMatch`, `isMatchWith`, `isEqualWith`, `conformsTo`, `toPlainObject`, `toSafeInteger`, `toLength`, `toFinite`, `toInteger`, `toNumber`, `toString`, `castArray`, `toArray`, `toPath` | They ask about, or convert between, the kinds of value of JavaScript; Nuclear's types are known when the code is written (`x is T`, `toInt()`, `toDouble()`, `toString()`, `isNaN`, `isFinite`) |
| `create`, `functions`, `functionsIn`, `forIn`, `forOwn`, `keysIn`, `valuesIn`, `assignIn`, `assignWith`, `mergeWith`, `cloneWith`, `cloneDeepWith`, `defaultsDeep`, `at`, `result`, `update`, `updateWith`, `setWith`, `transform`, `entriesIn` | They work on an object's prototype and own properties, or take a customizer called with JavaScript's arguments; a module of Nuclear is not a bag of properties |
| `debounce`, `throttle`, `defer`, `delay`, `now` | Timers of the JavaScript event loop; Nuclear waits with `~delay(ms)` and reads the time with `DateTime.now()` |
| `template`, `templateSettings`, `deburr`, `parseInt` with a radix, `split` with a limit | Text interpolation is `"${x}"`; a table of Latin letters and the rest were left for when a program asks for them (the roadmap) |
| `flattenDeep`, `flattenDepth`, `flatMapDeep`, `flatMapDepth`, `zipObjectDeep`, `unzipWith`, `sortedLastIndexBy`, `sortedLastIndexOf`, `sortedUniqBy`, `pullAllBy`, `pullAllWith`, `intersection` of more than two lists | Lists of unknown depth have no type in Nuclear; the others are a composition of two helpers here |
