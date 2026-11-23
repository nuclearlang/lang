# The standard library of Nuclear

> Part of the base language ([nuclear-base.md](nuclear-base.md)). The members of Nuclear's base types and its few
> objects, written the same in every dialect (ADR-lang-0009). Each dialect translates them into the target's expert
> code (`xs.length` → `len(xs)` in Python, `xs.add(x)` → `xs.push(x)` in TypeScript). Type definitions of
> libraries ([definitions.md](definitions.md)) are not part of this: `numpy`, `dio` or `Text(...)` are written as
> the library names them, and tie the code to that dialect.

## Rules

- **One name per operation.** Properties (no parentheses) for cheap queries: `length`, `isEmpty`, `first`, `last`,
  `keys`, `values`, `year`. Methods for everything else.
- **The receiver's type decides the member.** It is known from a declared type, a literal, a library member, a
  declared function or a type definition. When it is not known and the name belongs to two types that are not
  written the same way, the transpiler asks for a type on the receiver (a fix in the diagnostic).
- **A library's own members stay its own.** The receiver is not a value of a base type when it is a module (`np` of
  `use numpy as np`) or a function, a class or an object of a library's type definitions (`lodash`): `np.max(list)`
  and `lodash.map(list, f)` are written as they are, also when the name is one of this library.
- **A target's name on a base type is an error**, with the Nuclear name as the fix: `xs.push(x)` → "use `add`",
  `len(xs)` → "use `xs.length`", `s.toUpperCase()` → "use `upper`".
- **Membership is the `in` operator** (`x in xs`, `"b" in text`, `key in map`, `x in set`): there is no `contains`
  or `has`.
- Generated code pays nothing: a property is a property or a call of the target, a method is the target's method
  or a one-line helper of the dialect, never a runtime layer.
- `examples/stdlib/*.nuc` run in every language dialect and print the same text (`nuclearlang/tools/stdlib-check.sh`).

## 1. `string`

| Member | Gives | Meaning |
|---|---|---|
| `length` | `int` | number of characters (code units) |
| `isEmpty` | `boolean` | `length == 0` |
| `s[i]` | `string` | the character at `i` |
| `codeAt(i)` | `int` | the code unit at `i` |
| `upper()` `lower()` | `string` | case |
| `trim()` `trimStart()` `trimEnd()` | `string` | without surrounding whitespace |
| `startsWith(text)` `endsWith(text)` | `boolean` | |
| `indexOf(text)` `lastIndexOf(text)` | `int` | position, `-1` when absent |
| `substring(start, end?)` | `string` | `end` exclusive, to the end when omitted |
| `split(separator)` | `string[]` | `separator`: a `string` or a `Regex` |
| `chars()` | `string[]` | one element per character |
| `replace(from, to)` | `string` | the first occurrence |
| `replaceAll(from, to)` | `string` | every occurrence; `from`: `string` or `Regex`; `to`: `string` or `(m: Match) => string` |
| `repeat(n)` | `string` | |
| `padStart(width, fill = " ")` `padEnd(width, fill = " ")` | `string` | |
| `toInt()` `toDouble()` | `int?` `double?` | `null` when the text is not a number |
| `toBigInt()` `toBigDouble()` | `bigint?` `bigdouble?` | the exact number, `null` when the text is not one (§5.1) |
| `compareTo(other)` | `int` | `< 0`, `0`, `> 0` |
| `String.fromCodes(codes: int[])` | `string` | |

`+` joins strings; `'${a} ${b}'` interpolates; `"b" in text` searches.

## 2. Lists: `T[]`

| Member | Gives | Meaning |
|---|---|---|
| `length` `isEmpty` | `int` `boolean` | |
| `first` `last` | `T` | an error on an empty list |
| `xs[i]` · `xs[i] = v` | `T` | read, write |
| `add(x)` `addAll(ys)` `insert(i, x)` | `void` | in place |
| `remove(x)` | `boolean` | removes the first equal element; whether it was there |
| `removeAt(i)` `removeLast()` | `T` | in place |
| `clear()` | `void` | |
| `indexOf(x)` `lastIndexOf(x)` | `int` | `-1` when absent |
| `map(f)` | `R[]` | `f: (x: T) => R` |
| `filter(f)` | `T[]` | the elements where `f` is true |
| `find(f)` | `T?` | the first element where `f` is true |
| `findIndex(f)` | `int` | `-1` when none |
| `any(f)` `all(f)` | `boolean` | |
| `count(f)` | `int` | how many satisfy `f` |
| `reduce(initial, f)` | `R` | `f: (acc: R, x: T) => R` |
| `sum()` | `int` or `double` | numbers only |
| `min()` `max()` | `T?` | `null` on an empty list |
| `join(separator = "")` | `string` | |
| `slice(start, end?)` `take(n)` `skip(n)` | `T[]` | new lists |
| `reversed()` `sorted()` `sortedBy(key)` | `T[]` | new lists; `key: (x: T) => K` |
| `reverse()` `sort()` `sortBy(key)` | `void` | in place |
| `unique()` | `T[]` | first occurrences, in order |
| `flatten()` | `T[]` | of a `T[][]` |
| `copy()` | `T[]` | a shallow copy |
| `groupBy(key)` | `<K, T[]>` | in order of first appearance |

`[...xs, ...ys]` concatenates, `[first, ...rest] = xs` destructures, `x in xs` searches, `for x in xs` iterates,
`0..n` is a range (a list of `int`).

## 3. Maps: `<K, V>`

| Member | Gives | Meaning |
|---|---|---|
| `length` `isEmpty` | `int` `boolean` | |
| `m[k]` | `V?` | `null` when the key is absent |
| `m[k] = v` | `void` | adds or replaces |
| `remove(k)` | `V?` | the value removed |
| `keys` `values` | `K[]` `V[]` | in insertion order |

`{ "a": 1 }` is a literal (an empty map needs its type: `ages: <string, int> = {}`), `k in m` asks for a key,
`for k, v in m` iterates. There is no `get`: `m[k] ?? fallback`.

## 4. Sets: `Set<T>`

`Set<T>()` and `Set.of(xs)` build one. `length`, `isEmpty`, `add(x)` (`boolean`: whether it was new), `remove(x)`
(`boolean`), `x in s`, `toList()`, `union(other)`, `intersection(other)`, `difference(other)` (new sets).

## 5. Numbers: `int` and `double`

| Member | Gives | Meaning |
|---|---|---|
| `abs()` | same type | |
| `sign()` | `int` | `-1`, `0`, `1` |
| `round()` `floor()` `ceil()` `truncate()` | `int` | `round` is half away from zero |
| `toFixed(digits)` | `string` | fixed decimals |
| `toInt()` `toDouble()` `toString()` | | conversion |
| `toBigInt()` `toBigDouble()` | `bigint` `bigdouble` | the exact value (§5.1) |
| `toRadix(base)` | `string` | `255.toRadix(16)` is `"ff"` |
| `isNaN` `isFinite` | `boolean` | `double` |

`toBigInt()` and `toBigDouble()` of a number give its exact value (`2.5.toBigInt()` is `2`, toward zero;
`0.1.toBigDouble()` is `0.1`, from the shortest text of the double); a `double` that is not finite is an error.

### 5.1 The exact numbers: `bigint` and `bigdouble`

The rules of the types are in [nuclear-base.md](nuclear-base.md) §5.1.

| Member | `bigint` | `bigdouble` | Meaning |
|---|---|---|---|
| `abs()` | `bigint` | `bigdouble` | |
| `sign()` | `int` | `int` | `-1`, `0`, `1` |
| `round()` `floor()` `ceil()` `truncate()` | | `bigint` | `round` is half away from zero |
| `roundTo(digits)` | | `bigdouble` | rounded half away from zero to `digits` decimals |
| `toFixed(digits)` | | `string` | fixed decimals, rounded half away from zero |
| `toInt()` | `int?` | `int?` | toward zero; `null` outside ±(2^53 − 1), the integers every target holds |
| `toDouble()` | `double` | `double` | the nearest double |
| `toBigDouble()` | `bigdouble` | | exact |
| `toBigInt()` | | `bigint` | toward zero |
| `compareTo(other)` | `int` | `int` | `-1`, `0`, `1`; `other` of the same type (a literal takes it) |
| `toString()` | `string` | `string` | digits; the shortest exact text with at least one decimal (`2.0`) |

**The check functions** are the parsing members of `string`: `text.toBigInt()` (`bigint?`) accepts an optional sign
and digits; `text.toBigDouble()` (`bigdouble?`) also a decimal part and an exponent (`-0.5e2`); spaces around are
ignored, any other text (`"1."`, `"1_000"`, `"abc"`) gives `null`. A member of an exact number needs a receiver whose
type is known. Not theirs yet (`N0120`): `Math`, a `Set` of `bigdouble`, and the list members `sum`, `min`, `max`
(for `bigdouble` also `sorted`, `sort`, `unique`, `indexOf`, `lastIndexOf`, `remove`).

`Math`: `Math.pi`, `Math.e`, `Math.sqrt(x)`, `Math.cbrt(x)`, `Math.hypot(a, b)`, `Math.sin(x)`, `Math.cos(x)`,
`Math.tan(x)`, `Math.asin(x)`, `Math.acos(x)`, `Math.atan(x)`, `Math.atan2(y, x)`, `Math.exp(x)`, `Math.log(x)`,
`Math.log10(x)`, `Math.log2(x)`, `Math.min(a, b)`, `Math.max(a, b)`, `Math.clamp(x, low, high)`, `Math.random()`
(a `double` in `[0, 1)`). Powers are `**`, integer division `~/`, the rest as in [nuclear-base.md](nuclear-base.md)
§6.1. Parsing is `"42".toInt()`.

## 6. `boolean`

`toString()` gives `"true"` or `"false"`; `not`, `and`, `or` are the operators.

## 7. `Json`

`Json.encode(value)` gives the JSON text of a value (models through their JSON form; an exact number goes as the text of
its `toString()`, §5.1); `Json.decode(text)` gives
`any` (maps, lists, strings, numbers, booleans, `null`).

## 8. `Regex` and `Match`

`Regex(pattern, ignoreCase = false, multiline = false)`; patterns are written as raw strings (`r"\d+"`).
`test(text)` (`boolean`), `find(text)` (`Match?`), `findAll(text)` (`Match[]`). A `Match` has `text`, `start`,
`end`, `m[i]` (group `i`, `string?`) and `group(name)` (`string?`). The string members `split`, `replace`,
`replaceAll` take a `Regex`.

## 9. `DateTime` and `Duration`

`DateTime.now()`, `DateTime.utc(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0)`,
`DateTime(year, month, ...)` (local), `DateTime.parse(iso)` (`DateTime?`), `DateTime.fromMillis(ms)`.
Properties: `year`, `month` (1–12), `day`, `hour`, `minute`, `second`, `millisecond`, `weekday` (1 Monday … 7
Sunday), `millis` (since the epoch, UTC), `isUtc`. Methods: `add(d)`, `subtract(d)` (a `Duration`),
`difference(other)` (`Duration`), `isBefore(other)`, `isAfter(other)`, `toUtc()`, `toLocal()`, `toIso()`.

`Duration(days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0)`; `inDays`, `inHours`, `inMinutes`,
`inSeconds`, `inMillis` (whole units); `+`, `-`, comparisons.

## 10. Asynchrony

A value not awaited yet has the type `Future<T>`. `~delay(ms)` waits; `~awaitAll([a(), b()])` waits for all and
gives their results in order. `~` and generators: [nuclear-base.md](nuclear-base.md) §4.1.

## 11. `Bytes`

`text.toBytes()` (UTF-8) and `bytes.toText()`; `Bytes.of(ints)`, `Bytes.fromBase64(text)`, `Bytes.fromHex(text)`;
`length`, `bytes[i]` (`int`), `slice(start, end?)`, `toList()` (`int[]`), `toBase64()`, `toHex()`.

## 12. Output and errors

`print(a, b, ...)` writes the values separated by spaces and a newline, and `"${x}"` writes a value the same way:
a decimal with its decimals (`2.0`, `1000.0`), a boolean as `true` / `false`, a missing value as `null`, in every
dialect. The dialect knows a decimal by its type (a decimal literal, a division, a value declared `double`).
`x.toString()` exists on every value; only numbers, booleans, strings, `DateTime` (`toIso()`) and `Duration` print the
same text in every dialect: a list or a map is printed through `join` or `Json.encode`.

`Error(message)` is the base error (`e.message`); `throw`, `try`/`catch` and `Result` are in
[nuclear-base.md](nuclear-base.md) §3.2 and §7.

## 13. Helpers

Functions every file has without a `use` (ADR-lang-0013): the helpers of lodash that serve Nuclear, written in
Nuclear. A program gets only the ones it calls: in the file itself when it is built alone, in one generated file of
the project otherwise. Each one's signature and meaning: `nuclear help helpers`.

| Area | Helpers |
|---|---|
| Lists | `chunk`, `compact`, `difference`, `differenceBy`, `differenceWith`, `dropRight`, `dropWhile`, `dropRightWhile`, `takeWhile`, `takeRight`, `takeRightWhile`, `fill`, `findLastIndex`, `findLast`, `initial`, `tail`, `nth`, `intersection`, `intersectionBy`, `intersectionWith`, `union`, `unionBy`, `unionWith`, `uniqBy`, `uniqWith`, `xor`, `xorBy`, `without`, `pull`, `pullAt`, `remove`, `sortedIndex`, `sortedLastIndex`, `sortedIndexBy`, `sortedIndexOf`, `sortedUniq`, `zip`, `unzip`, `zipWith`, `zipObject` |
| Collections | `countBy`, `keyBy`, `partition`, `reject`, `flatMap`, `reduceRight`, `orderBy`, `sample`, `shuffle`, `sampleSize`, `forEachIndexed`, `forEachRight` |
| Numbers | `mean`, `meanBy`, `sumBy`, `maxBy`, `minBy`, `roundTo`, `floorTo`, `ceilTo`, `inRange`, `randomInt`, `range`, `rangeRight` |
| Texts | `words`, `capitalize`, `upperFirst`, `lowerFirst`, `camelCase`, `kebabCase`, `snakeCase`, `startCase`, `lowerCase`, `upperCase`, `truncate`, `pad`, `escape`, `unescape`, `escapeRegExp`, `trimChars`, `trimCharsStart`, `trimCharsEnd` |
| Maps and data | `pick`, `omit`, `pickBy`, `omitBy`, `mapValues`, `mapKeys`, `invert`, `invertBy`, `defaults`, `findKey`, `findLastKey`, `toPairs`, `fromPairs`, `get`, `has`, `set`, `unset`, `cloneDeep`, `merge` |
| Functions | `identity`, `constant`, `negate`, `once`, `memoize`, `after`, `before`, `flip`, `partial`, `partialRight`, `curry`, `flow`, `flowRight`, `times`, `attempt`, `uniqueIds` |

`Pair<A, B>` (`first`, `second`) is what `zip`, `unzip`, `partition`, `toPairs` and `fromPairs` use, since Nuclear
has no tuples.

- A helper is a function, never a member: `chunk(xs, 2)`, `camelCase(text)`. What a base type already has stays its
  member (`xs.map(f)`, `xs.unique()`, `s.trim()`): no helper repeats it.
- An iteratee is a lambda, and its parameters take their types from the helper: `uniqBy(users, (u) => u.name)`.
- A name is a helper only where nothing nearer defines it: a local, a member, a declaration of the file or of the
  project, or a name imported with `use` is the program's own.
- A helper wins over a function a target has under the same name; that function is reached with its `use`.
- Inside a module that extends a class nothing describes, a free name is that class's member: no helper is brought.
