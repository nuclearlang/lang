---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-website-0002: Each onboarding is run when the site is built, and gives the example of the tree

## Context and problem
Each platform needed an onboarding and an example app. A tutorial written by hand drifts from the tools: a command
changes its output or its options, and the page keeps showing the old one. And an example app written by hand
proves nothing about the tools ([ADR-platform-0004](../../../docs/03-adr/0004-products-are-made-with-the-tools.md)).

## Decision
1. **Each example app is made only by commands**: `nuclear new`, `nuclear gen resource`, `nuclear check`. The steps
   are data in `site.toml` (`[[onboarding]]`); the apps are the platforms' `examples/onboarding/` (`todos_api`,
   `todos_web`, `todos_app`), one story: an API of todos and two clients that list them.
2. **The site runs the steps again on every build** (`tools/content.mjs`), in a scratch folder, with the installed
   `nuclear`. It shows each step's real output, builds the shown file with every dialect of the platform, and
   measures the lines. **The build fails** when a step fails or when the `.nuc` files the steps make are not the
   example of the tree; `UPDATE_EXAMPLES=1` writes the example from them when a tool changes on purpose.
3. **The examples are also goldens** of the compiler's conformance test (`nuclear-transpile/tests/projects.rs`) and
   each platform has a user guide of the same steps (`docs/08-guides/onboarding-<platform>.md`).
4. The steps need no network and no target toolchain (no Flutter, Node.js or Python): a step that needs one (build,
   install, run) is shown as a command to run, not replayed.

## Options considered
1. Replayed steps, the example checked against them (chosen).
2. Outputs recorded once in a file: no cost at build time, and silently stale.
3. Examples written by hand: against ADR-platform-0004.

## Consequences
- Positive: the onboarding can never lie; a change of a generator shows up as a failed site build or a golden
  diff; the onboardings are a test of `new`, `gen` and `check` on the three platforms.
- Negative: the site build runs the compiler a dozen times (a few seconds); a deliberate change of a generator
  means `UPDATE_EXAMPLES=1` and `UPDATE_GOLDEN=1`.

## References
- [ADR-website-0001](0001-the-site-sells-the-idea.md); ADR-codegen-0001 (the generators).
