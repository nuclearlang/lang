---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-website-0001: The site sells the idea: hooks first, then a page per tool and per platform

## Context and problem
The site published the documentation well, but its home page only compared a sample in three languages. Everything
else NuclearLang offers (the generators, the MCP server, the editors, the Smart Graph, the local agents, three
platforms from one codebase) was not shown, so a visitor could not see the value. NuclearLang is free: "selling"
means making the value proposition obvious and leading each interested visitor to where it is explained.

## Decision
1. **The home page is a series of hooks**, from the most general to the most concrete, each a small interactive
   block that links to its page: why Nuclear (six one-line hooks), the same code in TypeScript, Dart and Python, an
   agent's mistake fixed by `nuclear fix`, the commands that make an app replayed in a terminal with the numbers
   they give, the same file built for two dialects, the platforms, the tools, a library of the target, install.
2. **Each tool has a page** (`/tools/<key>`) with its pitch, three highlights, how it starts, and the index of its
   documents (its user guides, `docs/08-guides/`, which every tool now has); `/tools` is the index of the tools by
   job (build, edit, run, AI). The detail lives in the tool's own guides; the page only leads to them.
3. **Each platform has a page** (`/platforms/<key>`) that goes down level by level, as in the C4 model: the context
   (the app, its users and what it talks to), the containers (the project, the compiler and dialect, the generated
   app, the runtime), the components (the layers of a component), and the code (a real file of its example and what
   each dialect writes from it). Its onboarding (`/start/<key>`) builds the example app step by step.
4. **Every claim is real.** A number is measured when the site is built (lines written by the tools, lines the
   dialect writes) or comes from a measured report (the run time of generated code, 0.98× to 1.11× of an expert's);
   an output is the compiler's or a command's, never written by hand. A claim that does not hold is not made (the
   thesis that Nuclear is shorter than hand-written code for a small program does not hold, so it is not sold).
5. **The texts stay data**: every word of the hooks, the tools and the platforms is in `site.toml`; the pages of
   documentation stay the projects' `.md`.

## Options considered
1. Hooks, then pages per tool and per platform, every claim measured (chosen).
2. A longer home page with everything on it: one page to scroll, but nothing to link to and no place for detail.
3. Marketing copy written freely: faster, and impossible to keep true.

## Consequences
- Positive: a visitor sees the value in one scroll and reaches any tool or platform in one click; every tool got a
  user guide; the site cannot claim what the tools do not do, since it runs them.
- Negative: `site.toml` grows (the tools and the platforms are data); the pages of the tools and the platforms are
  screens of the app, so they have no plain HTML copy in `/static/` yet ([roadmap](../01-product/roadmap.md)).

## References
- [ADR-website-0002](0002-onboardings-are-run-when-the-site-is-built.md), [ADR-website-0003](0003-libraries-of-the-target-through-nuclear-add.md).
