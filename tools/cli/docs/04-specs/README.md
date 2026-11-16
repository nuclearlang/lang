# Specs of the command line tools

One folder per change being built: `NNN-name/`. Life cycle: `draft → approved → in-progress → done`. A change that
touches several projects is in the tree's root (`docs/04-specs/`): the one command (`dragonfly` merged into
`nuclear`) is spec 008 there, tasks T2.1 and T2.2.

| Spec | What | Status |
|---|---|---|
| [001-agent-support](001-agent-support/plan.md) | Agents write correct Nuclear and Dragonfly without spending tokens: the evaluation, the brief, the skill, `agent init`, the hook, diagnostics with fixes, validation against the type definitions | in-progress: F1–F6 done (ADR-cli-0002; the diagnostics: `ADR-lang-0010`); F7 left (harder tasks: a new project from scratch, nothing to copy, also for fastapi; then tune the brief) |
