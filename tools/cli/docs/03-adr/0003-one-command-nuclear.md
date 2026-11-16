---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0003: One command line tool, `nuclear`, with the framework's commands

## Context and problem
NuclearLang had two binaries: `nuclear` (the compiler's: build, check, fix, fmt, help, spec, defs, contracts) and
`dragonfly` (the framework's: new, make, gen, run, test, migrate, packages, devices). A person or an agent had to know
which of the two a task needed, and two of their commands had the same name with different meanings: `nuclear build
app.nuc --dialect dart` transpiles a file, `dragonfly build apk` builds a project. The user decided that everything
is `nuclear`, and that the framework is called Synapsis.

## Decision
1. **One binary, `nuclear`.** The framework's commands are commands of `nuclear`, in the module `framework/` of this
   crate. The `dragonfly` binary does not exist.
2. **A command line is the framework's** when its command is one only the framework has (`new`, `make`, `gen`,
   `run`, `test`, `install`, `migrate`, `add`, `remove`, `device`, `terminal-device`, `watch`, `code`, `analyze`,
   `clean`, `repair`, `explain`, `pub`, `flutter`, `doctor`, `setup`...), or when there is no command (the landing
   page).
3. **`build` and `check` decide by their argument.** With a path (`nuclear build app.nuc`, `nuclear check .`) they are
   the compiler's, as they always were. Without one, or with a target of the platform's own tool (`nuclear build
   apk`), they work on the project of the framework they run in.
4. **`agent init`** reads the project's manifest when it runs inside a project of the framework; elsewhere it is the
   compiler's (`--dialect`).
5. `nuclear help` lists both: the compiler's commands and topics, then the framework's commands.
6. The generators (`make`, `gen`) are the code generator's library (`tools/code_generator`) and the devices the
   devices' (`device-emulators`); the command only parses, calls them and prints.

## Options considered
1. Two binaries: two names to learn, and an agent picks the wrong one.
2. One binary where the framework's commands get a prefix (`nuclear project build`): longer commands for the common
   case, and every guide changes twice.
3. One binary that tells the two meanings of a name by its argument.

## Consequences
- Positive: one command to install, to learn and to give an agent; the framework's guides read `nuclear new`,
  `nuclear run`, `nuclear test`.
- Negative: `build` and `check` without a path outside a project are an error ("no main.nuc or config.nuc"), where
  the compiler alone used to print its usage.

## References
- The rule in the code: `framework::claims` (`tools/cli/src/framework/mod.rs`).
- The work: `docs/04-specs/008-restructure/` (root).
