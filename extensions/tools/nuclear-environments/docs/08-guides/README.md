---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../../README.md]
---
# Environments

1. Read settings in your code with `env("NAME", "default")`; `env("NAME")` without a default is required.
2. Open the page: the **ENV** tool of the Nuclear workspace (`Ctrl+Alt+Y`), or *Nuclear: Open Environments*. Pick the
   project at the top.
3. Each row is a variable, each column an environment; the first column is the shared `.env` every environment
   reads. A cell shows the value and where it comes from (`.env`, `.env.staging`, a `.local` file, `keyring`,
   `process`); an empty one shows the default.
4. Edit: double-click a cell (or reach it with the arrows and press Enter), type, Enter saves, Escape cancels. Tick
   *Secret* to keep the value in the system's keyring: it is typed masked and never written to a file. The bin
   deletes a value.
5. *Local* writes to the `.local` files (ignored by git: only your machine). *Active* chooses the environment
   `nuclear run`, `build` and `check` use by default.
6. *+ Variable* and *+ Environment* add a row or a column; the first value you set writes its file.
7. Watch the badges: **missing** (red) is a required variable without a value in the active environment — the app
   will not start; **client** is baked into a web or mobile build; **unused** is in a file but no code reads it.
   Click a use under a name to open the code at the line; the arrow of a column opens its `.env` file.

The same from a terminal: `nuclear env list`, `nuclear env set NAME VALUE --env staging`. If the page asks you to
update NuclearLang, your `nuclear` is older than the page: run `nuclear update` in a terminal.
