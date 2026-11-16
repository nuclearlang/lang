---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../07-reference/python.md, ../03-adr/0001-python-dialect-and-generic-emitter-options.md, fastapi.md, dependencies.md]
---
# The `python` dialect: how the base language is written in Python

`python` is a language dialect: it extends no other, so it defines every `[syntax]` template. `fastapi`
([fastapi.md](fastapi.md)) extends it. The normative equivalences, construct by construct, are
[../07-reference/python.md](../07-reference/python.md); this document says where each thing is decided and why.
The meaning of every option and template variable: `nuclear spec` and
[the dialect format](../../../../docs/07-reference/dialects.md).

## Files

| File | Holds |
|---|---|
| `dialect.toml` | `[dialect]` (extension `py`, indent of 4 spaces, `defs = ["python@3.14"]`), `[options]`, `[syntax]`, `[types]`, `[operators]`, `[names]`, `[auto_imports]`, `[modifiers]`, `[project]`, `[imports]`, `[functions]` |
| `keywords.toml` | Python 3.12's reserved words, each with how Nuclear produces it (`via = "base"`, `"auto"`, `"none"`) and a note. Inherited by `fastapi` |
| `library.toml` | one template per member of Nuclear's standard library (`[library.string]`, `[library.list]`...); a `helper` is written once per file |
| `docs.toml` | `[words]`: the editor's text for `static`, `get`, `set`, `abstract`. Skipped by the loader |
| `templates/result.tpl` | the `Result` runtime written into a file that uses `Result` |
| `templates/doc_comment.tpl` | a doc comment as a docstring (one line, or summary + `Args:` + `Returns:`) |

## Options and what each is for

Python is the first target whose blocks have no braces, whose lambdas are one expression and whose classes set
their fields in `__init__`. Each of those needs is a generic option of the emitter (ADR-python-0001), set here:

| Option | Effect in the output |
|---|---|
| `implicit_self = false` | members are written with `self.` |
| `named_args = "native"` | `f(x = 1)` → `f(x=1)`; a decorator's named argument too |
| `declare_ctor_fields`, `init_fields` | `User(name: string)` → an annotation at class level and `self.name = name` in `__init__`; a field with a default is set in `__init__` (no shared mutable defaults). A subclass without its own constructor keeps class defaults |
| `optional_params_nullable` | `name?: string` → `name: str \| None = None` |
| `snake_case_names` | `getOne()` → `get_one()` (see Names) |
| `doc_inside` | a doc comment is the docstring of its function, method or class |
| `hoist_block_lambdas` | a lambda with a block becomes a local `def _fnN(...)` before its statement |
| `interp_prefix = "f"`, `interp_brace_escape`, `interp_open/close = "{" "}"`, `dollar_escape = "never"` | `"Hi ${name}"` → `f"Hi {name}"`; literal braces doubled |
| `reserved_escape = "suffix"` | a Nuclear name that is a Python word gets `_` (`json_`) |
| `max_bases = 0` | multiple inheritance (no limit of bases) |
| `catch_var = "error"` | the variable of a `catch` without a name; `except Exception as <name>` is written only when the block names the value (`catch_used`), `except Exception:` otherwise |
| `cascade_statements` | `p = Paint()` + `..color = x` → `p = Paint()` and `p.color = x` |
| `module_separator = "."` | `use langchain_core/tools` → `from langchain_core.tools import ...` |
| `type_args_as_args` | `inject<Repo>()` → `inject(Repo)`: Python passes classes as values |
| `toplevel_gap = 2`, `line_width = 88` | PEP 8's two blank lines; black / ruff's width |
| `omit_null_default = false` | `= None` is written |

`[syntax] file_prelude` starts every file with `from __future__ import annotations`: annotations are evaluated
lazily, so a method can name its own class (Python 3.12 and 3.13 need it).

## Names

The `.nuc` keeps Nuclear's rule (`camelCase` for variables, functions, methods, fields and parameters; `PascalCase`
for classes). `snake_case_names` renames the AST before emitting (`naming.rs` in the compiler): `getOne` →
`get_one`, `minLength = 1` → `min_length=1`. A name that exists as it is in the type definitions (`getLogger` of
`logging`) is kept. Strings and map keys are data and never change.

## Declarations

- A module with code is a `class`; a module with only signatures is a `Protocol` (`interface` template).
- Generics are PEP 695: `class Box[T]`, `def f[T: Bound]`.
- An enum is `class X(Enum)`; an item without a value is `auto()`.
- `static` → `@staticmethod` without `self`; `get` → `@property`; `set` → `@name.setter` (never returns);
  `abstract` writes nothing.
- A method that overrides one of a base gets `@override`.
- `{a, b}` parameters are keyword-only (`*, a, b`).
- Two kinds that import each other only for the type checker use `[syntax] type_imports`
  (`if TYPE_CHECKING:`), turned on per kind with `type_imports = true`.

## Expressions that are not one-to-one

| Nuclear | Python | Why |
|---|---|---|
| `a == null` / `a != null` | `a is None` / `a is not None` | PEP 8 (`null` flag of the `eq` / `not_eq` templates) |
| `x is int` | `type(x) is int` | `bool` is a subclass of `int` |
| `x is T[]` | `isinstance(x, list)` | |
| `a ?? b` | `a if a is not None else b`; with a call or a map read on the left, `_coalesce(a, lambda: b)` | the left side is evaluated once and pyright narrows it; the right side stays lazy |
| `a >>> n` | `(a % 0x100000000) >> n` | Python ints have no width: as on a 32-bit value, like TypeScript |
| `m[k]` on a map (read) | `m.get(k)` | a map read is `None` when the key is absent; a list index stays an index |
| `x!` | `_sure(x)` | an assertion pyright understands |
| `x as T` | `cast(T, x)` | |
| `x?.name` | `(x.name if x is not None else None)` | |
| `[a, if cond b]` | `*([b] if cond else [])` | |
| `print(a, b)` | `_print(a, b)` | booleans and `null` print as Nuclear writes them (`true`, `false`, `null`) |
| `delay(ms)`, `awaitAll(xs)` | `asyncio.sleep(ms / 1000)`, `asyncio.gather(*xs)` | |

`_sure`, `_coalesce`, `_print` and the library's helpers are written once per file, only when used.

## `Result`

`Result<E, T>`, `Ok` and `Err` are the file's own runtime, `templates/result.tpl` (`result_runtime`): a class with
`is_ok`, `is_err`, `value`, `error`, `and_then`, `inspect`, `or_else`, `inspect_err`, `map`, `get_or_else`. Its type
variables are explicit and covariant: a frozen dataclass is invariant from Python 3.13 on because of
`__replace__`. Propagation is `if r.is_err: return Err(r.error)`. A dialect that extends this one and has a
runtime sets `builtin_result = false` and imports `Result` from it.

## Imports

- `[auto_imports]`: names of `typing` (`Any`, `Protocol`, `Callable`, `Literal`, `cast`, `override`...), `enum`,
  `dataclasses`; and the modules the library templates write, imported as themselves (`import math`, `json`, `re`,
  `base64`, `datetime`, `functools`, `random`, `asyncio`). Those module names are reserved for Nuclear identifiers.
- `[names] written` lists what the templates write, so a file imports a name only when its generated code uses it.
- Every other name comes from the type definitions ([dependencies.md](dependencies.md)).
- `[imports]`: `use` shortcuts for `asyncio`, `json`, `math`, `re`, `os`.

## The standard library

`library.toml` writes [Nuclear's library](../../../../docs/07-reference/library.md) with Python's: lists are
`list`, maps `dict`, sets `set`, `Bytes` is `bytes`, `DateTime` is `datetime.datetime` (aware when UTC), `Duration`
is `datetime.timedelta`, `Regex` is `re.Pattern` (built through `_regex`, which also writes `(?<name>...)` as
`(?P<name>...)`), `Match` is `re.Match`. An expression lambda becomes a comprehension (`xs.map((x) => x * 2)` →
`[x * 2 for x in xs]`). `string.length` counts code points. `Error(message)` is `Exception(message)` and
`e.message` is `str(e)`. The full account: [../07-reference/python.md](../07-reference/python.md) §4.

## Projects

`[project] sources = "app"`: in a `nuclear.toml` project with `dialect = "python"` the `.nuc` files go to the
package `app/`, or to the one `[project] package = "my_lib"` names, and import each other as
`from <package>.<path> import Name` (`project_import = "{{package}}.{{path}}"`).
