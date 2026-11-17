---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [tools/cli/src/framework/landing.rs]
---
# Landing, header, help and colors of the framework's commands (`framework/landing.rs`)

- `nuclear` without arguments: the animation ONLY the first time (the marker
  `$XDG_STATE_HOME/synapsis/intro_seen`, removed by `installer/install.sh --uninstall`), then the page alone.
  `nuclear credits` (alias `author`): always the full animation and the page with the credits (Julian Molina,
  github.com/nodelorien, github.com/nuclearlang).
- The animation takes ~7 s and is a CONCEPT, not realistic: a radioactive mushroom in ASCII, a wave of characters
  that fills the screen and dissolves into `█▓▒░`; "WELCOME" (5-row letters) appears in negative, turns green with
  "to NuclearLang · Synapsis" and dissolves; then the page: the NuclearLang sign, large (`sign` radius 12), on the
  left, and the names and how to start on the right. The only logo is Nuclear's (the user, 2026-11-17).
- Only characters over the terminal's background: no background colors (a test checks it), the theme's text color in
  normal / bold / dim and few accents; fades are dissolves. Synapsis is a name in purple; the NuclearLang symbol is drawn `ASPECT` (1.35) times wider to look round.
- The page stays alive until Enter (a thread reads stdin; Enter during the animation jumps to the page, except in
  `credits`; EOF only closes a complete page); a shine crosses the sign every `SHINE_EVERY` (5 s); without a
  terminal on stdin it ends by itself.
- `header()`: before any command of the framework's (not on the bare page nor `credits`; the compiler's commands
  and `nuclear help` print none), a 6-row header with the
  small sign (`sign` radius 6), NuclearLang and Synapsis, on stderr and only in a terminal.
- Output colors: `ok` green = done, `bad` red = error, `warn` yellow = warning or note, `cmd` blue = commands, `name`
  purple = project and step names, `dim` = paths and details; `diagnostics()` colors the transpiler's errors; only
  if stdout and stderr are terminals and there is no `NO_COLOR`. In `watch`, `nuclear: transpiling|ready|errors`
  has no color (the VS Code task looks for it).
- `usage()`: the help with a width-1 symbol per section and command (⚙ build, ✿ new, ⚗ test...; only symbols in
  common monospace fonts, checked with `fc-list :charset=`). Without a terminal or with `NO_COLOR`, the plain text.
  Without a terminal, with `NO_COLOR` or below 80×23, the bare `nuclear` shows only the page.
- To review the animation without a terminal: `script -qc "stty cols 100 rows 30; nuclear" /dev/null` captures the
  frames (split by `ESC[?2026h`); a PIL script turns them into images.
