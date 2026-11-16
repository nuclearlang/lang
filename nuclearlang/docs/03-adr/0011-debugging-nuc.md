---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0011: A `.nuc` is debugged through the target's debugger with a line map, not with aligned output nor a debugger of its own

## Context and problem

A developer sets a breakpoint in the `.nuc`, but what runs is the generated code. Either the generated code is
bent to match the source line by line, or a debugger is written for Nuclear, or the target's debugger is kept and
told which line is which.

## Decision

**A line map.** The emitter records, for each generated file, the pairs (generated line → Nuclear line) of each
statement, member, declaration and argument on its own line. The generated code is not aligned line by line with
the `.nuc`: it stays readable. A build writes the map: a mobile app to `build/app/.dart_tool/nuclear_lines.json`,
any other project to `<output>/.nuclear/lines.json`. Editors set a mirror breakpoint in the generated file, show
the `.nuc` line of each pause and can mark an error of the target on its `.nuc` line with a side window that
explains it (`dragonfly explain`).

**Mixed debugging, on top of the target's session.** In a Flutter app the session is the Dart extension's: steps
go by Nuclear line (the Dart step is repeated until another `.nuc` line), active when the pause came from a `.nuc`
breakpoint or the focus is on a `.nuc`; a `.dart` breakpoint gives Dart steps. Variable values are shown in the
`.nuc`, with a Nuclear call stack and a command to go to the same line in Nuclear or Dart. VS Code's native stack
still shows Dart.

## Options considered

1. Generated code aligned line by line with the source: rejected, the output would stop being readable.
2. An own debug adapter that translates messages: rejected, it would lose devices, DevTools and the Inspector.

## Consequences

- Positive: the generated text does not change because of debugging (the golden tests prove it); every tool of the
  target's debugger keeps working; the same map serves every dialect.
- Negative: the editor's native call stack shows the target's frames; each editor has to implement the mirror
  breakpoints and the stepping on its side.

## References

- `docs/02-architecture/emitter.md` (the line map), `crates/nuclear-transpile/src/project.rs`
  (`LINE_MAP_FILE`, `line_map`); the editors' side is documented in `../extensions/`.
- Replaces: ADR-0068, ADR-0076
