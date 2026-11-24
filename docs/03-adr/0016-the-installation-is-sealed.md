---
status: accepted
date: 2026-11-24
deciders: Julian Molina
---
# ADR-platform-0016: No agent changes Nuclear; the installation is sealed and a changed one builds nothing

## Context and problem
An agent working on a product (an app, a migration) that meets a limit of the compiler can "fix" it where it
lives: edit a template of an installed dialect, drop a folder `dialects/fastapi/` in the project (the loader
searched a project's own dialects before the installed ones), point `NUCLEAR_DIALECT_PATH` elsewhere, or patch the
runtime. The product then builds with a Nuclear nobody else has: the same `.nuc` means something else on another
machine (ADR-platform-0014), and the limit is hidden instead of reported.

## Decision
1. **An agent never changes Nuclear** while it works on a product: not the compiler, a dialect, a template, a
   platform's contract, a generator, a runtime package, the installation or the MCP server. A limit is said to the
   user and reported (the capability that is missing); work on Nuclear itself is done in NuclearLang's own
   repository, by its team.
2. **The installation is sealed.** The installers write `.seal` (the size, time and SHA-256 of every file of `bin/`,
   `dialects/`, `platforms/` and `generators/`) and make those folders read-only. `kinds/` (packages the user
   adds), `packages/` and `tools/` (written in place by package managers) and `ai/` are not sealed.
3. **A changed installation builds nothing.** Every load of a dialect from the installation compares sizes and
   times with the seal (a few milliseconds, once per process) and refuses with N0226; `nuclear doctor` compares the
   hashes too. The fix is to install again (`nuclear update --reinstall`).
4. **An installed dialect is never replaced.** A dialect found outside NuclearLang's own folders with the name of
   one of theirs is refused (N0225). A user's own dialect has a name of its own and `extends` an installed one.

## Options considered
1. Rules for agents only: nothing stops an agent that does not read them.
2. Rules, read-only files, and a build that refuses a changed installation (chosen).
3. Hash every file on every build: proves more, costs tens of milliseconds per build (the golden rule).

## Consequences
- Positive: the same `.nuc` builds the same on every machine with the same version; a gap of the compiler shows
  up as a report, never as a private patch.
- Negative: the seal is a guard, not a lock: a user (or an agent with the user's permissions) who restores the
  times and the permissions can pass the quick check; `nuclear doctor` still finds it. The runtimes of
  `packages/` are not sealed while setuptools builds `synapsis-py` in place.

## References
- Related: ADR-platform-0014 (stability and parity), ADR-platform-0015 (migration).
