---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-platform-0004: A product is made with the platform's tools, never by porting code by hand

## Context and problem
NuclearLang exists to prove that a language, its framework and its tools let people and agents build software.
An agent that writes a feature by hand in the target's language (React, Node.js, Python/FastAPI, Dart), or that
translates such code into Nuclear by itself, proves nothing: the product works, but nobody learns whether the
transpiler, the generators, the MCP server or the type definitions would have made it. It also hides every gap of
the tools behind work no one sees.

A **product** is any software made from Nuclear: an app, a backend, the website of the tree, an example, a tool of
the tree written in Nuclear.

## Decision
A product is made with the tools of the platform, and every agent (Claude Code, the local Nuclear Developer, any
agent reading the MCP server) follows it:

1. **The code is Nuclear and the target code comes from the transpiler.** No agent writes, edits or patches target
   code (`.ts`, `.dart`, `.py` of `build/`, or any native file of a product) to make a feature.
2. **No agent migrates code by hand.** Code of a native dialect (React, Node.js, Python/FastAPI, Dart) is never
   translated into Nuclear by the agent itself. What exists as a library is added with `nuclear add <package>` and
   used through its generated type definitions; what is standard is written by the generators.
3. **The tools come first, in this order:** `nuclear new`, `nuclear gen` and `nuclear make` (the code generator),
   the MCP server's tools, `nuclear add` (a library and its definitions), `nuclear fix` (the compiler's exact fixes);
   only what they leave is written by hand, in Nuclear.
4. **By hand, outside Nuclear, only when strictly necessary**: when a product cannot work otherwise, or when the
   work is on Nuclear itself (the compiler, a dialect, a runtime package, a tool that cannot yet be written in
   Nuclear: the root `AGENTS.md`, rule 9). The agent says so, and the missing capability becomes an item of the roadmap
   of the tool that should have done it, in the same change.

## Options considered
1. The tools first, by hand only when strictly necessary, every gap recorded (chosen).
2. Let agents write whatever is fastest: products ship sooner, and the platform is never tested.

## Consequences
- Positive: every product is a test of the tools; a gap shows up as a roadmap item instead of hidden hand-written
  code; the generated code stays as fast and as uniform as the generators make it.
- Negative: a feature a tool cannot make yet waits for the tool, or is written by hand with the gap recorded.

## References
- The root `AGENTS.md`, hard rule 13; the agents' instructions: `tools/cli/agent-files/` (the project section and
  the skill), `tools/mcp/server.nuc`, `nuclear-agents/nuclear_developer/AGENTS.md`.
