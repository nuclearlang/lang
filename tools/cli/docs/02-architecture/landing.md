---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [tools/cli/src/framework/landing.rs]
---
# Landing, header, help and colors of the framework's commands (`framework/landing.rs`)

- `nuclear` without arguments: the animation ONLY the first time (the marker
  `$XDG_STATE_HOME/synapsis/intro_seen`, removed by `installer/install.sh --uninstall`), then the page alone.
  `nuclear credits` (alias `author`): always the full animation and the page with the credits (Julian Molina,
  github.com/nodelorien, github.com/nuclearlang).
- The animation takes ~11 s and is a CONCEPT, not realistic: a radioactive mushroom in ASCII, a wave of characters
  that fills the screen and dissolves into `█▓▒░`, grass grows back and a synapsis lands on a flower; then the page
  with the NuclearLang and Synapsis logos. After the wave, "WELCOME" (5-row letters) appears in negative, turns
  green with "to NuclearLang · Synapsis" and dissolves. In the grass scene the motto is written (`motto`): Spanish
  if `LC_ALL` / `LC_MESSAGES` / `LANG` starts with `es` (localization data, the allowed exception to English
  everywhere), else English.
- Only characters over the terminal's background: no background colors (a test checks it), the theme's text color in
  normal / bold / dim and few accents; fades are dissolves. The synapsis is metallic purple (`metal`) with
  radioactive green eyes; the NuclearLang symbol is drawn `ASPECT` (1.35) times wider to look round.
- The page stays alive until Enter (a thread reads stdin; Enter during the animation jumps to the page, except in
  `credits`; EOF only closes a complete page); a shine crosses the synapsis every `SHINE_EVERY` (5 s); without a
  terminal on stdin it ends by itself.
- `header()`: before any command of the framework's (not on the bare page nor `credits`; the compiler's commands
  and `nuclear help` print none), a 6-row header with both
  small logos (`MINI`, `sign` radius 6), on stderr and only in a terminal.
- Output colors: `ok` green = done, `bad` red = error, `warn` yellow = warning or note, `cmd` blue = commands, `name`
  purple = project and step names, `dim` = paths and details; `diagnostics()` colors the transpiler's errors; only
  if stdout and stderr are terminals and there is no `NO_COLOR`. In `watch`, `nuclear: transpiling|ready|errors`
  has no color (the VS Code task looks for it).
- `usage()`: the help with a width-1 symbol per section and command (⚙ build, ✿ new, ⚗ test...; only symbols in
  common monospace fonts, checked with `fc-list :charset=`). Without a terminal or with `NO_COLOR`, the plain text.
  Without a terminal, with `NO_COLOR` or below 80×23, the bare `nuclear` shows only the page.
- To review the animation without a terminal: `script -qc "stty cols 100 rows 30; nuclear" /dev/null` captures the
  frames (split by `ESC[?2026h`); a PIL script turns them into images.
