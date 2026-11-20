---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../../AGENTS.md, ../../../../../docs/04-specs/021-environments/design.md]
---
# How the list reaches the page

```
the strip's ENV tool / nuclear.environments.open [root]
        ▼
EnvironmentsPanel.show(project) ──► nuclear env list --json --project <root> ──► toGrid ──► postMessage state
        ▲                                                                                  │
        │                                                                                  ▼
  refresh ◄── FileSystemWatcher **/.env*, **/.nuclear/contract.json, **/.nuclear/env     the page draws the grid
        ▲                                                                                  │
        └──── after every command ◄── nuclear env set / unset / use ◄── a message (set, unset, use)
```

- The project: the one given by the command (the workspace passes `nuclear.workspace.lastProject`), else the last
  one shown, else the first of the workspace (`Workspace.projects()`); the page's picker switches between them.
- The grid (`toGrid`): the columns are the shared `.env` and each environment of the list (plus the active one and
  the ones added on the page). A cell is the environment's resolved value and its `source` (`.env`,
  `.env.<name>`, a `.local` file, `keyring`, `process`); the shared column shows the value an environment took from
  `.env`. An empty cell shows the default. Badges: `required` (no default), `missing` (required, no value in the
  active environment), `secret` (a value in the keyring), `client` (read by web or mobile code), `unused`
  (`declared: false`).
- Added on the page: a new environment or variable is kept in the panel (per project) until a file has it; the
  first value set writes its file (`set --env <new>` creates `.env.<new>`).
- The commands (`env.ts`): `set NAME VALUE [--env E] [--local] --project R`; a secret is
  `set NAME --secret [--env E] --project R` with the value on stdin. `unset` follows the cell's source: `--secret`
  for the keyring, `--local` for a `.local` file, nothing for `process` (the button is disabled). `use E`. The
  *Local* toggle adds `--local` to `set` and makes *Open file* open the `.local` file.
- Failures (`failureOf`): no `nuclear` (spawn error) and a `nuclear` without `env` (exit not 0, its usage printed
  without `nuclear env`) replace the grid with a notice that says to run `nuclear update` in a terminal; any other
  error stays above the grid until dismissed. What a successful command writes on stderr (a secret written to a
  `.local` file without a keyring) is shown as a note.
- The page: `localize` (`extensions/vscode/src/i18n.ts`) gives it the language menu;
  its state comes in `state` messages, so a language switch redraws it as it was. Values are set as text only.
- Keyboard: the grid is one tab stop (a roving `tabindex`); arrows, Home/End (Ctrl: first/last row) move; Enter or
  F2 edits; Enter saves, Escape cancels; Delete removes the value; Enter on a name opens its first use; Ctrl+F
  filters.

- The page and its editor tab are titled in the language of the editor (`texts(ENV).title`: *Environments* / *Entornos*), like every text of the page.
