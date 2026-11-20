---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../02-architecture/overview.md, ../../../../../docs/04-specs/021-environments/tasks.md]
---
# Roadmap of Environments

- Never yet opened in a live VS Code against a real `nuclear env`: the command was built in parallel (spec 021).
  The page is tested by `test/environments.test.ts` (fixtures of the design's `list --json`, a fake runner) and was
  rendered headless with a fixture. Check it once the installed `nuclear` has `env`: the exact stderr of an older
  `nuclear`, that `set --secret` reads the value from stdin, and the note it prints without a keyring.
- The shared `.env` column shows a value only when an environment took it from `.env`: `list --json` does not
  print `.env`'s own values, so a value every environment overrides is not seen there. Needs a field in the list
  (e.g. `"shared": {value, source}` per variable) from the CLI.
- Environments and variables added on the page live in the panel until their first value is written: closing the
  page forgets them.
- Android Studio / IntelliJ parity (a tool window over the same `nuclear env` commands).
- The later phase of spec 021: simulating an environment locally (`--simulate`) from the page.
