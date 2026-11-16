# Decisions of the command line tools

Cited as `ADR-cli-NNNN`. The format is `docs/03-adr/0000-template.md` of the tree's root. An accepted ADR is not
edited: a new one replaces it and the old one is marked `superseded by ADR-cli-NNNN`.

| ADR | Decision | Status |
|---|---|---|
| [ADR-cli-0001](0001-a-projects-commands-come-from-its-dialects-data.md) | A project's commands come from its dialect's data (`[toolchain]`, the platform's default dialect, the project card); a dialect's own commands go under its name | accepted |
| [ADR-cli-0002](0002-agents-learn-nuclear-from-a-brief-a-skill-and-the-compiler.md) | Agents learn Nuclear from a short brief, one skill, a project's agent files and the compiler's errors | accepted |
| [ADR-cli-0003](0003-one-command-nuclear.md) | One command line tool, `nuclear`, with the framework's commands; `build`, `check` and `agent init` decide by their argument and the folder they run in | accepted |

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../../docs/03-adr/old-numbers.md).
