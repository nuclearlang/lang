# Dragonfly

The framework of NuclearLang. You write a **platform** (`mobile`, `backend` or `web`) in Nuclear: entities, use
cases, screens, endpoints, agents. A **dialect** is the language and framework it comes out in, and the Nuclear
code of a project never changes when its dialect changes. The guide, with every platform, its dialects and its
plugins: [docs/08-guides/README.md](docs/08-guides/README.md).

**Start with the tutorial:** [docs/08-guides/tutorial.md](docs/08-guides/tutorial.md) (`nuclear help tutorial`):
an app from scratch with a component, a repository, a screen and tests. Kinds, yours and the community's:
[docs/08-guides/kinds.md](docs/08-guides/kinds.md). The generators: [docs/08-guides/generators.md](docs/08-guides/generators.md).

## The `dragonfly` command

Creates and works with apps written in NuclearLang: only `.nuc` files; for a Flutter app, the app is generated in
`build/app`. Full rules of the mobile commands:
[flutter.md §11](../nuclearlang/dialects/dart/docs/07-reference/flutter.md) (`nuclear help flutter`).

### Install

```sh
cd <the NuclearLang tree>
installer/install.sh         # nuclear and dragonfly in ~/.local/bin + the VS Code extension
dragonfly doctor             # checks everything is there: CLIs, dialect, dragonfly package, Flutter, VS Code
dragonfly setup              # if Flutter is missing: installs it step by step (system packages, SDK, PATH)
```

`installer/install.sh --uninstall` removes it. Flutter is found by itself (PATH, fvm, `~/development/flutter`...);
`FLUTTER` or `FLUTTER_ROOT` choose another one.

### Diagnosis and Flutter

- `dragonfly doctor`: checks what NuclearLang and Dragonfly need (like `flutter doctor`): `dragonfly` and
  `nuclear`, the flutter dialect and its type definitions, the dragonfly Dart package, Flutter (where it is and
  whether it is missing from the PATH), VS Code with the NuclearLang, Dart and Flutter extensions, and the
  current project. Each problem comes with how to solve it. Flutter's own (Android, iOS, devices):
  `dragonfly flutter doctor`.
- `dragonfly setup`: installs Flutter following the official guide, asking before each step: system packages
  (apt, dnf, pacman, zypper or Apple's tools), the latest stable version checked with its sha256, unpacking into
  `~/develop` (`--dir` chooses another folder) and your shell's PATH.

### Landing page and credits

- `dragonfly` alone: the first time, an animation (the explosion, WELCOME, everything grows back and the
  dragonfly arrives) and the page with the logos; afterwards, only the page.
- `dragonfly credits` (or `author`): always the full animation, with the author and the repository.
- After WELCOME the motto appears: "Before, everything was chaos; now everything is simpler with Dragonfly" (in
  Spanish if your system is in Spanish).
- Every other command starts with a header with the NuclearLang and Dragonfly logos, and its messages are in
  colors: green = done, red = error, yellow = warning, blue = commands you can type.
- `dragonfly help` (or `-h`): the header and the commands with their symbols and colors. Through a pipe, or with
  `NO_COLOR`, everything comes out as plain text.

### Use

```sh
dragonfly                         # landing page
dragonfly new shop_app            # only .nuc + the Flutter app in build/app
dragonfly new -p backend -d fastapi shop_api   # another platform, with one of its dialects
cd shop_app
dragonfly code                    # VS Code: ▷ on a .nuc or F5 runs the app; saving a .nuc reloads it
dragonfly g c products            # component
dragonfly gen resource characters Character --from-json https://rickandmortyapi.com/api/character  # finished code from an API
dragonfly gen usecase characters CharacterEpisodes --calls CharacterRepository.episodes   # a use case over a repository method, wired
dragonfly g s products detail --route /detail -m DetailManager -st DetailView
dragonfly test
dragonfly help                    # every command
```

## Contributing

From the root of the tree, before a pull request:

```sh
cargo test && cargo clippy --all-targets
installer/install.sh --no-vscode       # the installed dragonfly and its help
```

- Everything is written in English: code, comments, docs and messages.
- A change that a user of NuclearLang can see updates its documentation in the same pull request: the reference of
  the area, the guide, and the documents for agents and contributors ([AGENTS.md](AGENTS.md)).
- Rules and the reasons behind them: [the root AGENTS.md](../AGENTS.md) and the decisions in
  [docs/03-adr/](docs/03-adr/README.md).

By contributing you agree that your contribution is licensed under the [Apache License 2.0](../LICENSE).
