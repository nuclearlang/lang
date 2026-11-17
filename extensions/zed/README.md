# NuclearLang for Zed

[![extension-zed](https://github.com/nuclearlang/lang/actions/workflows/extension-zed.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/extension-zed.yml) · [Website](https://nuclearlang.github.io/tools/zed)

The NuclearLang extension for Zed: a token grammar, the `nuclear-lsp` client, the Chernobyl theme and icons, and
the Synapsis tasks and runnables.

## Why

- The same diagnostics, quick fixes, completion and colors as VS Code and Android Studio: the server is the same.
- Zed allows no panels or keybindings: no workspace, devices or `.nuc` debugging; Nuclear Builder is not offered.

## How we made it

- **The same server as every editor**, the installed `nuclear-lsp`
  ([ADR-extensions-0001](../docs/03-adr/0001-one-base-extension-per-editor.md)).
- **A grammar of tokens only**: it never fails on half-written code; meaning comes from semantic tokens.
- **Generated, not copied**: theme and icons from the VS Code sources.
- **Written in Rust**, compiled to `wasm32-wasip2`. Never tried in a running Zed ([roadmap](../docs/01-product/roadmap.md)).

## Try it

```sh
rustup target add wasm32-wasip2      # once
cd extensions/zed && ./build.sh      # builds and installs into Zed
```

Then pick **Chernobyl** and turn on semantic tokens in `settings.json` ([the guide](docs/08-guides/README.md)).

## Read next

- [The guide](docs/08-guides/README.md)
- [What Zed does not allow](docs/02-architecture/overview.md)
- [The extensions](../README.md), [the roadmap](docs/01-product/roadmap.md)
- To change it: [AGENTS.md](AGENTS.md)
