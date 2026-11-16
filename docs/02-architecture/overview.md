---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: []
---
# Architecture of the platform

How the projects fit together. What is inside each is in that project's `docs/02-architecture/`.

## The layers

```
 editors      extensions/{vscode,jetbrains,zed}  +  extensions/tools/<tool>
                    │ LSP protocol                      │ run
 tools        nuclearlang/crates/nuclear-lsp      tools/cli: `nuclear`         tools/mcp: `nuclear-mcp`
                    │                             ├ tools/code_generator (nuclear-codegen)
                    │                             └ device-emulators (nuclear-devices)
                    │ Rust API (crates)                 │
 compiler     nuclearlang/crates: nuclear-syntax → nuclear-transpile ← nuclear-dialect, nuclear-diag
                    │ data: TOML, templates, type definitions
 dialects     nuclearlang/dialects/<language>/  and their frameworks/<dialect>/
                    │ implement
 framework    nuclear-synapsis-framework/platforms/<platform>/: the contract, the runtime packages
 AI           nuclear-graph-storage (what every agent reads)  ←  nuclear-agents/nuclear_developer
 delivery     installer/, website/ (the documentation site)
```

## From `.nuc` to the target

```
 .nuc text                                   the dialect's *.toml (+ its type definitions)
   │ 1 LEXER     text → tokens (INDENT/DEDENT)        │ loaded at run time:
   │ 2 PARSER    tokens → AST (no format)             │ inheritance, merge, validation
   │ 3 RESOLVER  block scope, undefined names,        ▼
   │             implicit this, const/let, async ◄── Dialect: kinds, shortcuts, auto-imports
   │ 4 EMITTER   AST → the dialect's templates  ◄── [syntax] [types] [operators] [options]
   ▼
 .ts / .dart / .py text  (+ a line map target → .nuc for debuggers)
```

Each stage knows only the one before. Diagnostics accumulate in all of them and come out as text or JSON.

## Rules of the design

1. The lexer turns indentation into tokens; inside `( ) [ ] { }` it emits none.
2. The AST has no format; every node keeps its position for errors and the language server.
3. The parser is generic: a dialect's words arrive as data in a declaration's header.
4. The transpiler knows no target language: TypeScript, Dart and Python are dialects like any other.
5. Data before code: dialects, shortcuts and imports are files read at run time; the same files feed the command
   line tool, the language server and the MCP server.
6. Imports are decided after emitting, from the words of the generated code.

## Borders that hold

- An extension talks to the language server only through the LSP protocol and its documented `nuclear/*` requests.
- One command line tool, `nuclear`: the compiler's commands and the framework's. It uses the compiler crates, the
  code generator and the devices as libraries; what it needs from a platform comes from the
  dialect's data (`[toolchain]`), never from a name written in Rust.
- A framework dialect lives with its language; the platform it implements lives with the framework. Neither
  describes the other.
- The local agents reach the graph and the compiler only through the graph's client and the tools it gives them.
- The MCP server is a Nuclear project of its own (`python` dialect); it reaches the graph through the graph's
  package and runs `nuclear` for a project's commands.
- The website (`website/`) reads the reference and the guides of every project at build time; no page is written
  in it.

## Qualities and how they are reached

| Quality | How |
|---|---|
| The same Nuclear on every dialect of a platform | the platform's contract, checked by the loader |
| Generated code as an expert writes it | the references' equivalences are the transpiler's real output (`spec-check`), the targets' analyzers in strict mode |
| Agents do not invent | type definitions, diagnostics with fixes, the briefs, the Smart Graph |
| Fast builds | data is read only when needed; a project build is incremental |
