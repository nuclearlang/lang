# NuclearLang for Zed

The NuclearLang extension for Zed: a tree-sitter grammar of tokens, the client of the language server
`nuclear-lsp`, the Chernobyl theme and icons, and the Synapsis tasks and ▷ runnables.

## Why it exists

For a developer who writes in Zed, it gives a `.nuc` file the same diagnostics, quick fixes, completion, hover,
navigation, rename and colors by meaning as VS Code and Android Studio, because the server is the same.

What it leaves out: Zed lets an extension add no panels, views, keybindings or actions on save, so there is no
Nuclear workspace, no device, no `.nuc` debugging and no build on save. Nuclear Builder is not offered for Zed
(decided by the user). A device opens in its own window with `nuclear device`.

## How we made it

- **The same server as every editor**
  ([ADR-extensions-0001](../docs/03-adr/0001-one-base-extension-per-editor.md)): Zed has no bundle, so the
  extension starts the installed `nuclear-lsp` and passes it `lsp.nuclear-lsp.settings`.
- **A grammar of tokens only**: comments, strings with `${}`, numbers, decorators, words, operators and nested
  brackets. It never fails on half-written code; what a name means comes from the server's semantic tokens.
- **Generated, not copied**: the theme comes from `../vscode/theme/build.mjs`, the icon themes from
  `scripts/icons.mjs` over the VS Code icon themes.
- **Written in Rust**, compiled to `wasm32-wasip2` with `zed_extension_api` 0.7.

**State:** never tried in a running Zed ([the editors' roadmap](../docs/01-product/roadmap.md)). Where a published
extension would read its grammar from is open ([roadmap](docs/01-product/roadmap.md)).

## Try it

```sh
rustup target add wasm32-wasip2      # once
cd extensions/zed && ./build.sh      # builds and installs into ~/.local/share/zed/extensions/installed/nuclearlang
```

`installer/install.sh` does the same when Zed is installed (`--no-zed` skips it), and installs the server in
`~/.local/bin/nuclear-lsp`. Zed reloads the extension by itself. Pick **Chernobyl** in *theme selector: toggle*,
then turn on the semantic tokens, outline, folding and code lenses in `settings.json`, which Zed leaves off by
default ([the guide](docs/08-guides/README.md)).

## Where to read next

| | |
|---|---|
| Install, turning the features on, the server's settings, the tasks | [docs/08-guides/README.md](docs/08-guides/README.md) |
| What each file does, and what Zed does not allow | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| What the three editors share | [the extensions](../README.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |
