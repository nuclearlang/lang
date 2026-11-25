---
status: accepted
date: 2026-11-25
deciders: Julian Molina
---
# ADR-platform-0017: A Nuclear library reaches a project as source; a runtime's own Nuclear is built into the runtime

## Context and problem

The parts of the platform written in Nuclear outside a project need a way into it: a database plugin with its
adapter (ADR-backend-0004), a library of helpers (ADR-lang-0013 already builds lodash's helpers with each project),
and the Synapsis ORM, which is part of the backend runtimes. The user decided on 2026-11-25 between three ways:
everything as source, everything prebuilt into the targets' packages, or source for libraries and prebuilt for what
belongs to a runtime.

## Decision

**A library or a plugin is a package of `.nuc` source.** `nuclear add` installs it (for the project, or for every
project from the installation); each build transpiles it with the project, to the project's dialect, into `build/`,
as the helpers of lodash are today. The same rules hold for it as for the project's own code: the diagnostics, the
golden rule, no warning of the target.

**The Nuclear of a runtime is built into the runtime.** What a runtime package needs from Nuclear (the Synapsis ORM in
`synapsis-py` and `synapsis-nest`) is transpiled when the runtime is built, by the installer and the checks, and
ships as the target's code inside the package. A project never compiles the runtime.

## Options considered

1. **Source for libraries and plugins, built into the runtime for a runtime's own** — chosen.
2. **Everything as source**: one rule, but every build compiles the whole ORM and a runtime is no longer whole by
   itself.
3. **Everything prebuilt** into pip and npm packages: fast builds, but a plugin an agent writes in a project would
   need its own build and install.

## Consequences

- Positive: a plugin an agent writes is built and checked exactly like the project; one source serves every dialect.
- Positive: the runtimes stay complete packages of their target; a project's build time does not grow with them.
- Negative: the installer and the runtime checks run the transpiler; a change of the transpiler rebuilds the
  runtimes.
- Negative: a package of source needs a way into `nuclear add`, the loader and the language server (spec 005 T1).

## References

- [ADR-backend-0004](../../nuclear-synapsis-framework/platforms/backend/docs/03-adr/0004-every-database-is-a-plugin.md)
  (every database is a plugin), [ADR-lang-0013](../../nuclearlang/docs/03-adr/0013-helpers-are-part-of-the-language.md)
  (the helpers are the language's), ADR-platform-0016 (the installation is sealed: an installed package is read-only).
