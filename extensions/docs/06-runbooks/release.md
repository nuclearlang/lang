---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/language-server.md, ../../vscode/AGENTS.md, ../../jetbrains/AGENTS.md, ../../zed/AGENTS.md]
---
# Release the extensions

Done after every change of the server, a client, the themes or the bundled dialects and type definitions, without
asking. The three extensions share one version; Zed's follows VS Code's.

## Steps

1. Raise the version (minor for a feature, patch for a fix) in:
   - `extensions/vscode/package.json`
   - `extensions/jetbrains/resources/META-INF/plugin.xml`
   - `extensions/zed/extension.toml`
   - the examples of each `README.md` that name a version
2. Write the change in the `CHANGELOG.md` of each extension it reaches.
3. Build:

   ```sh
   (cd extensions/vscode && npm run package)                           # → nuclearlang-<version>.vsix
   (cd extensions/jetbrains && IDE_HOME=/opt/android-studio ./build.sh) # → build/nuclearlang-<version>.zip
   (cd extensions/zed && ./build.sh)                                    # builds and installs into Zed
   ```

4. Install: `installer/install.sh`. It installs the newest `.vsix` of `extensions/vscode/` (`sort -V`), rebuilds
   `nuclear-builder`, and runs `extensions/zed/build.sh` when Zed is installed (`--no-zed` skips it).
5. Tell the user to quit VS Code completely (*File → Exit*: a reload does not refresh a theme) and to install the zip
   in Android Studio (*Settings → Plugins → ⚙ → Install Plugin from Disk…*).

## Verification

- `npm run package` and `jetbrains/build.sh` end with `nuclear-lsp --check-bundle`: a bundle whose dialects do not
  load fails the build.
- The JetBrains plugin installed unpacked is in `~/.local/share/Google/AndroidStudio2026.2.1/nuclearlang`.
- Zed reloads the extension by itself; if not, restart Zed.

## Not done yet

The marketplaces: the VS Code listing and the binaries for macOS and Windows are in the roadmaps
([common](../01-product/roadmap.md), [VS Code](../../vscode/docs/01-product/roadmap.md)). The public installers and
the release workflow are [the installer project](../../../installer/AGENTS.md)'s.
