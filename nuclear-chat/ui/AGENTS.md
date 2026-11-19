# AGENTS.md

<!-- nuclearlang -->
## NuclearLang

This project is written in NuclearLang (`.nuc`), dialect `react`. Its syntax is not TypeScript, Dart nor Python.

- Before writing code, read the sheet: `nuclear spec --brief --dialect react`.
- After each change: `nuclear check --json` must report no errors; fix exactly what each error says (most carry a `fix`).
- Look up instead of guessing: an API `nuclear defs show <Name> --dialect react`; a kind or decorator
  `nuclear help <word> --dialect react` (all: `nuclear help words --dialect react`); a topic `nuclear help <topic>`.
- Create each piece with `nuclear make ...` (`nuclear help`); after `nuclear check`, run `nuclear analyze` and, with tests, `nuclear test`.
- A library the project does not have (npm, PyPI, pub.dev): `nuclear add <package>` installs it and generates its type definitions; then use its names (they are imported for you). Never install it by hand in `build/`.
- Never edit generated code (`build/`): change the `.nuc` files.
- Make it with the tools: `nuclear gen`, `nuclear make`, the MCP server, `nuclear add` for a library. Never write
  target code for a feature nor translate TypeScript, Dart or Python into Nuclear by hand; when a tool cannot do
  something, say so instead of working around it.
<!-- /nuclearlang -->
