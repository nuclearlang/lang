---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../../../docs/08-guides/README.md, ../../../docs/02-architecture/language-server.md]
---
# NuclearLang for Zed

The extension `nuclearlang` for Zed: a tree-sitter grammar, the language server `nuclear-lsp`, the Chernobyl theme
and icons, and the Synapsis tasks. What the three editors share: [the extensions](../../../docs/08-guides/README.md).

## Install

- **With the installer**: `installer/install.sh` builds and installs it when Zed is installed and the Rust target
  is present (`rustup target add wasm32-wasip2`). `--no-zed` skips it.
- **By hand**: `./build.sh` in `extensions/zed/`. It builds the extension and copies it into
  `${XDG_DATA_HOME:-~/.local/share}/zed/extensions/installed/nuclearlang`. Zed reloads it by itself; if it does
  not, restart Zed.
- Zed has no bundled server. It uses the installed `nuclear-lsp` (`~/.local/bin/nuclear-lsp`), which finds its
  dialects and type definitions in the installation.

TODO(human): is the extension published in Zed's extension registry, or is installing it as a dev extension
(*zed: install dev extension* on `extensions/zed/`) a supported way? Neither is documented today.

Then pick the theme (*theme selector: toggle*) and the icon theme (*icon theme selector: toggle*): **Chernobyl**
or **Chernobyl Soft**, and **Chernobyl Icons** or **Chernobyl Soft Icons**.

## Turn on the features

By default Zed turns off the server's semantic tokens, outline, folding and code lenses. Turn them on in
`settings.json`:

```json
{
  "code_lens": "on",
  "languages": {
    "Nuclear": { "semantic_tokens": "combined", "document_symbols": "on", "document_folding_ranges": "on" }
  }
}
```

The server gives diagnostics, quick fixes, completion, hover, signature help, go to definition, references, rename,
outline, folding and the colors by meaning. A click on a code metrics lens shows the details as a message.

## Settings of the server

The server's settings are the `nuclear.*` settings of VS Code, without the prefix:

```json
{
  "lsp": {
    "nuclear-lsp": {
      "settings": { "dialect": "flutter", "codemetrics": { } },
      "binary": { "path": "/path/to/nuclear-lsp" }
    }
  }
}
```

The server is found at `lsp.nuclear-lsp.binary.path`, then on the `PATH`, then at `~/.local/bin/nuclear-lsp`.

## Tasks and the ▷ in the gutter

*task: spawn* (`alt-shift-t`) lists the tasks. Run them from any `.nuc` of a project.

| Task | What it runs |
|---|---|
| Nuclear: generated code of *file* | `nuclear build <file> --dialect flutter`: prints the generated code |
| Nuclear: check *file* | `nuclear check <file> --dialect flutter` |
| Synapsis: run (r = hot reload, R = hot restart) | `nuclear run`, in a new terminal |
| Synapsis: device (own window, like an emulator) | `nuclear device` |
| Synapsis: terminal device (inside this terminal) | `nuclear terminal-device` |
| Synapsis: build | `nuclear build` |
| Synapsis: watch (build on every save) | `nuclear watch` |
| Synapsis: test | `nuclear test` |
| Synapsis: test "*name*" | `nuclear test -- --plain-name "<name>"` |
| Synapsis: analyze | `nuclear analyze` |
| Synapsis: repair | `nuclear repair` |
| Synapsis: explain the error in the clipboard | the clipboard (`wl-paste` or `xclip`) into `nuclear explain` |

The two *Nuclear:* tasks always pass `--dialect flutter`.

In the gutter, ▷ next to `main(` offers run, device and terminal device. ▷ next to each `@test`, `@widget` or
`@states("name")` runs only that test.

To see a change in a running app, start **watch** and **run**, then press `r` in the run terminal.

## What Zed does not allow

Zed gives an extension no panels, views, keybindings or actions on save. So there is no Synapsis device inside the
editor (`nuclear device` opens its own window), no `.nuc` breakpoints or debugging, no build and hot reload on
save, no automatic repair, no generated code view beside the file and no Nuclear workspace. Nuclear Builder and
Nuclear Connector are not offered in Zed. They are in [VS Code](../../../vscode/docs/08-guides/README.md).
