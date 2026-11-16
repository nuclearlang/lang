---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: Python is a dialect made with the dialect system, and what it needs becomes generic emitter options

## Context and problem

The user asked for a dialect with Python completely in its base, made with the dialect system, and with the type
definitions of LangChain, LangGraph, FastAPI, Chroma, Postgres, Ollama and OpenAI by default. Python is the first
target whose blocks have no braces, whose lambdas are one expression and whose classes set their fields in
`__init__`. The plan for dialects (`nuclearlang/docs/04-specs/002-dialects-with-agents/`, D7) says such needs
become generic `[options]`, never a case of one language in the compiler.

## Decision

**The target.** Python 3.12+ typed, checked with `pyright --strict` (the role `tsc --strict` and `flutter analyze`
have for the other targets); PEP 8 layout (4 spaces, 88 columns, two blank lines between top-level declarations);
PEP 695 generics; docstrings.

**Generic options and templates, not Python cases.** Everything Python needed was added to the emitter as options
and templates any later target can use, listed by `nuclear spec`:

- `hoist_block_lambdas` + `local_function`: a lambda with a block becomes a local function before its statement.
- `init_fields` + `field_init`: constructor parameters and fields with a default are set in the constructor (no
  shared mutable defaults); a subclass without its own constructor keeps class defaults.
- `super_ctor`; `doc_inside` (the doc comment goes to the template's `doc`).
- `interp_prefix` + `interp_brace_escape` (f-strings); `module_separator`; `toplevel_gap`; `file_prelude`
  (`from __future__ import annotations`).
- `type_args_as_args`: `inject<Repo>()` → `inject(Repo)`.
- `builtin_result`: a child dialect uses a library's `Result`.
- `snake_case_names`.
- Template variables `names` (lambda parameters without types), `types` (function types), `items_list` (enums);
  the filter `strip_suffix`.
- A named argument of a decorator is written with the dialect's `named_arg`. The scan of the words a file writes
  reads f-string interpolations and `#` comments.

**`Result`.** The file's own runtime (`templates/result.tpl`), with explicit covariant type variables: a frozen
dataclass is invariant from Python 3.13 on because of `__replace__`.

**Names.** The `.nuc` keeps Nuclear's `camelCase` (`nuclearlang/docs/07-reference/nuclear-base.md` §2.4): a dialect
never changes the language. `snake_case_names` writes the names in Python's `snake_case` (`getOne` → `get_one`):
the compiler renames the AST before emitting and keeps the names that exist as they are in the type definitions;
strings and map keys are data.

**Type definitions** come from the installed modules: `nuclearlang/tools/defs/python/gen.py` reads them with
`inspect`, from the virtual environment `nuclearlang/tools/python/.venv` pinned by
`nuclearlang/tools/python/requirements.txt`. `python@3.14` (the standard library; builtins implicit) for this
dialect, and for `fastapi`: pydantic, pydantic-settings, starlette, fastapi, sqlalchemy, asyncpg, redis, aiokafka,
openai, ollama, chromadb, langchain_core, langchain, langgraph, langchain_openai, langchain_ollama,
langchain_chroma and the runtime.

## Options considered

1. Generic `[options]` and templates in the emitter, set by the dialect. Chosen.
2. Cases for Python in the compiler. Rejected: the transpiler knows no target language.
3. Asking for `snake_case` names in the `.nuc` so the dialect writes them as they are. Rejected by the user: the
   `.nuc` would break Nuclear's naming for the convenience of one target.

## Consequences

- Positive: `nuclearlang/examples/examples-python/tour.nuc` (golden) runs and passes `pyright --strict`;
  `nuclearlang/dialects/python/docs/07-reference/python.md` has 15 checked equivalences.
- Positive: the options are available to any later target with the same needs (Ruby, Elixir, Kotlin scripts).
- The compiler's messages use the Nuclear names; the generated file shows the `snake_case` ones.
- Negative: none recorded.

## References

- Replaces: ADR-0089
