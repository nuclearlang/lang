<!-- nuclearlang -->
## NuclearLang

This project is written in NuclearLang (`.nuc`), dialect `{dialect}`. Its syntax is not TypeScript, Dart nor Python,
and nothing about it is in your training: learn it from the installation, never from guesses or other folders.

- With the `nuclear` MCP server: call `nuclear_start` first (what Nuclear is, the rules, the work cycle, the atlas of
  every topic), then `nuclear_doc(<topic>)`. Without it: `nuclear help start`, `nuclear help atlas`.
- Size each request first (`nuclear help task-size`): small (≤ 3 files, ≤ 100 lines) and medium (≤ 10 files,
  ≤ 400 lines) without a new feature are yours to do; a new feature, more, or several specs: propose Nuclear Builder
  with your count, and let the user decide.
- This project's own documents (`docs/README.md`) win over the default way of documenting (`nuclear help context-docs`).
- Before writing code, read the sheet: `nuclear spec --brief --dialect {dialect}`.
- After each change: `{check}` must report no errors; fix exactly what each error says (most carry a `fix`).
- Look up instead of guessing: an API `nuclear defs show <Name> --dialect {dialect}`; a kind or decorator
  `nuclear help <word> --dialect {dialect}` (all: `nuclear help words --dialect {dialect}`); a topic `nuclear help <topic>`.
{synapsis}{packages}- Never edit generated code ({generated}): change the `.nuc` files.
- Make it with the tools: `nuclear gen`, `nuclear make`, the MCP server, `nuclear add` for a library. Never write
  target code for a feature; when a tool cannot do something, say so instead of working around it.
- A project of another technology is migrated by reading it and rewriting it in Nuclear with the tools (MCP
  `migration_inspect`, then `graph_strategy("migrate a project into Nuclear")`), never line by line.
- Never change Nuclear (the compiler, a dialect, a template, a runtime, the installation): a limit is reported, not
  patched. The installation is sealed and a changed one builds nothing (N0226).
<!-- /nuclearlang -->
