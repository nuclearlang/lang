---
name: nuclear-language
description: Work in NuclearLang and its framework Synapsis on this machine: what the language and its command line do, what they cannot do and what to do then, the platforms and dialects, the work cycle (generate, write, check, test). Use for every task that touches a .nuc file, a Synapsis project or the Nuclear command line.
title: Nuclear and its command line
title_es: Nuclear y su línea de comandos
description_es: Trabajar en NuclearLang y su framework Synapsis en esta máquina: lo que el lenguaje y su línea de comandos hacen, lo que no pueden hacer y qué hacer entonces, las plataformas y los dialectos, el ciclo de trabajo (generar, escribir, comprobar, probar). Úsalo en toda tarea que toque un archivo .nuc, un proyecto Synapsis o el comando nuclear.
kind: technology
tags: [nuclear, nuclearlang, synapsis, cli, dialects, platforms, transpiler, limits]
base: true
---
# Nuclear and its command line

## When to use

Always, before writing or reviewing any `.nuc`. Nuclear is not TypeScript, Dart nor Python and nothing about it is
in a model's training: look every word up, never guess it. Read `nuclear help` (the atlas of topics) and the short
sheet of the platform with `nuclear spec --platform backend --brief` (or `mobile`, `web`).

## Steps

1. **Know where you are.** A Synapsis project is the folder with `config.nuc` (its platform and dialect); a
   workspace is the folder with `.workspace/workspace.nuc` naming its apps. Three platforms: `backend` (dialects
   `fastapi`, `nestjs`), `web` (`react`), `mobile` (`flutter`). The Nuclear of a project is the same in every dialect
   of its platform: a dialect only changes the generated code.
2. **Generate first.** A new project: `nuclear new`. Standard parts (a resource, a screen, a use case, a component):
   `nuclear gen` and `nuclear make`, never written by hand; `nuclear gen inspect` says what the project has.
3. **Write the rest in Nuclear.** Look up each word: `nuclear help <word> --dialect <dialect>`; a library's
   declarations: `nuclear defs show <Name> --dialect <dialect>`. A library the project lacks: `nuclear add <package>`.
4. **Check and correct.** `nuclear check .` (or `--json`), `nuclear fix .` for the exact fixes, `nuclear fmt .`;
   `nuclear explain <code>` tells what a diagnostic means.
5. **Test and run.** `nuclear test`, `nuclear run` (`--monitor` to measure), `nuclear build .` to see the output.

## The platform's tools

- What Nuclear does: transpile (`nuclear build`), check (`nuclear check`, `nuclear fix`, `nuclear fmt`), create and
  extend projects (`nuclear new`, `nuclear gen`, `nuclear make`, `nuclear migrate`), libraries (`nuclear add`,
  `nuclear remove`, `nuclear defs`), contracts between apps (`nuclear contracts`), tests and runs (`nuclear test`,
  `nuclear run`, `nuclear device`, `nuclear monitor`), the documentation (`nuclear help`, `nuclear spec`).
- MCP server `nuclear`: `nuclear_start`, `nuclear_doc`, `nuclear_check`, `nuclear_build`, `generate_*`,
  `nuclear_project`, `graph_strategy`. What the editor does and the MCP server does not is listed in
  `nuclear_doc("mcp")`, section 4.

## Pitfalls

- Writing target code (`.ts`, `.dart`, `.py`) for a feature, or translating native code into Nuclear by hand: a
  product is made with the tools; what they cannot do is said to the user, never faked.
- Naming a target's library (React, Flutter, FastAPI, an npm or PyPI name) in platform code: the standard library is
  Nuclear's own (`nuclear help library`).
- Bending the `.nuc` to a dialect: names stay camelCase and the syntax stays the base one, whatever the dialect.
- Editing what is generated: `build/`, `contracts/<name>/*.nuc`.
- Claiming something works without `nuclear check .` clean and `nuclear test` green.

## Checklist

- [ ] Every word used was looked up (`nuclear help`, `nuclear defs show`).
- [ ] Standard parts came from `nuclear gen` or `nuclear make`.
- [ ] No target-language file or library name in platform code.
- [ ] `nuclear check .` is clean and `nuclear test` is green.
- [ ] What the tools could not do was told to the user, with where it is done.
