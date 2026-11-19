---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [emitter.md, dialects.md, type-definitions.md, ../03-adr/0010-compiler-helps-editors-and-agents.md]
---
# Emitter options and target-specific mechanisms

What a dialect switches on in `[options]` and the generic mechanisms a target asked for. A target's need is always
added as an option any dialect can set, never as a case of one language.

## Options (`[options]`)

`implicit_self named_args declare_ctor_fields const_collection_defaults optional_params_nullable
number_separators string_quote interp_quote interp_open interp_close dollar_escape reserved_escape max_bases
catch_var toplevel_statements line_width trailing_comma omit_null_default interp_bare_names binary_literals
int_member_parens`

- `omit_null_default`, `interp_bare_names`: Dart without `= null` and with `$name`, to avoid lint warnings.
- `binary_literals = false`: Dart writes `0b1010` as `0xa`.
- `int_member_parens`: TS `(5).toString()`.

The full list with its meaning is the contract (`crates/nuclear-dialect/src/contract.rs`, printed by
`nuclear spec`).

## Targets without braces (Python; ADR-python-0001)

- `hoist_block_lambdas`: `block_lambda` pushes a `local_function` to `pending`, the lambda is its name `_fnN`.
- `init_fields`: `field_inits` + constructor params → `field_init` lines after the super call; a deferred
  constructor when written before the fields; the `field` template gets `in_init`; not for a kind with its own
  `field` nor a subclass without its own constructor.
- `super_ctor`.
- `doc_inside`: `doc_into` stores the rendered doc in `inner_doc`; `function`/`method`/`class`/kind templates read
  `doc`.
- `interp_prefix` / `interp_brace_escape`, `module_separator` (`sep`), `toplevel_gap` (also the blank lines `tidy`
  keeps), `type_args_as_args`, `builtin_result` (`Dialect::syntax` hides `result_runtime`), `file_prelude`.
- `snake_case_names` (`naming.rs`): renames the camelCase names of the AST before emitting. The `.nuc` keeps
  Nuclear's camelCase; names that exist as they are in the type definitions stay; string text and map keys are
  data.
- `code_words` reads f-string `{x}` and `# ` comments.
- Decorator named arguments use `named_arg` when `named_args = "native"`.
- An empty constructor text is not inserted.

## What the backend dialects asked for (ADR-typescript-0001)

- `project_import` gets `relative` (from the output file to the import, `ProjectCtx::relative`) and `package`
  (the folder the project's files go to as a module: `Manifest::sources`, the `[project] package` of
  `nuclear.toml`, else the dialect's `sources`; Python writes `{{package}}.{{path}}`).
- `alias_via = "constructor"`: `alias.rs` adds the target modules as constructor parameters and calls
  `field.method`.
- `params_list` entries get `route` (named in a decorator's route string, `route_params`).
- Kinds get `field_decor`; `field` gets `tinfo`; `methods` entries get `doc_text`/`doc_literal`.
- Project templates get `components` and `uses`.
- `type_args_as_args` takes a list of functions.
- N0219 of a constructor of the type definitions only with native named arguments; of a function or method
  declared in Nuclear, always.

## Checks against the type definitions (ADR-lang-0010)

`check_construct`: N0219 (a named argument not in `ClassDef.params`, only when the auto-import of the name comes
from the same package: `def_libraries`) and N0220 (a PascalCase call unknown to the project, the auto-imports, the
globals, the types and the defs; skipped without type definitions, with an open import or an open module).

## Call sites (logs; ADR-mobile-0005)

`[call_site.<Module>] arg, text` (`Dialect.call_site`, `Emitter::call_site`/`with_source`): every `Log.x(...)`
gets `at: '<component> › <kind> › <Class.method> · <path>.nuc:<line>'`.
