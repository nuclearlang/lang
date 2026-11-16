---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../../theme/README.md, ../../../docs/02-architecture/overview.md]
---
# The Chernobyl themes and the icons (`theme/`)

One source for the three extensions. The color tables of each variant are in
[`theme/README.md`](../../theme/README.md); the code metrics are in
[the common architecture](../../../docs/02-architecture/overview.md).

## The generators

| File | What it does |
|---|---|
| `theme/palette.json` | the only source: one entry per variant in `variants` (Chernobyl, Chernobyl Soft), each with its interface and, if it defines one, its code palette (`syntax` over the common `syntax`) |
| `theme/build.mjs` | the themes of VS Code (`themes/<variant>-color-theme.json`), JetBrains (`resources/themes/<Variant>.theme.json`, `<Variant>.xml`, `<Variant>.icls`) and Zed (`themes/chernobyl.json`); the generated `syntaxes/nuclear-example.tmLanguage.json` |
| `theme/icons.mjs` | the `.nuc` icon, `icons/nuclear.svg`, `icons/platform-<platform>.svg`, and the icon themes **Chernobyl Icons** and **Chernobyl Soft Icons** in `icon-themes/` |
| `theme/vendor-atom-icons.mjs` | updates `vendor/atom-material-icons/` (MIT), the base of the icons, from the installed extension |

`npm run theme` runs `build.mjs` and `icons.mjs`. Edit the palette or a generator, never their output. A sibling
extension that is not there is skipped.

## The variants

- **Chernobyl**: an almost black background, radioactive green accents.
- **Chernobyl Soft** (the user's variant): a slate background, burnt-yellow interface accents and vivid syntax:
  classes violet, variables pink, keywords orange, functions mint green, library functions and operators cyan, enums
  lemon yellow, strings lime. No italics. The user wants vivid, bright colors.

Semantic token colors are `semanticTokenColors` in VS Code and the `DEFAULT_*` keys in JetBrains.

## Comments

- A doc tag at the start of a comment line: `@tag` → `storage.type.class.jsdoc.nuclear`, the name of a `@param` →
  `variable.other.jsdoc.nuclear`, with the roles `docTag` / `docParam`, dimmed (`mix(..., background, 0.55)`):
  everything in a comment looks like a comment.
- The code of an `@example` (more space after `*` than the tag) is `comment.example.nuclear` +
  `source.nuclear.example`. Any theme paints it as a comment; Chernobyl dims it with `comment.example.<scope>`.

## The icons

- The `.nuc` icon is a flat single-color trefoil on a 24 grid (yellow in Chernobyl, burnt yellow in Soft). The
  detailed trefoil (a yellow disc with a shadow) is only the logo of the extension and the plugin.
- The icon themes are every icon and association of Atom Material Icons, plus the trefoil for `.nuc` and the generic
  folder in the variant's color. The workspace's file tree reads the same files
  ([workspace.md](workspace.md)).
- `icons/nuclear.svg`, the container's icon, is the trefoil as a `currentColor` mask: the activity bar paints every
  icon in the theme's color, so a colored logo is not possible there.

## The colors of the HTTP Connections tree

`theme/build.mjs` sets `nuclearHttpConnections.get/post/put/patch/delete/platform/project/component` from the palette (type,
function, warning, number, error, primary, enumMember, property), so the tree follows each variant. `package.json`
contributes the same ids with neutral dark and light defaults for other themes; a theme may override them. In a
webview they are `var(--vscode-nuclearHttpConnections-get)`.

## Testing a changed theme

VS Code caches the active theme (`colorThemeData` in `~/.config/Code/User/globalStorage/state.vscdb`); *Reload
Window* does not refresh it. Quit VS Code completely (*File → Exit*), or render a preview with the real tokens (the
grammar and the server).
