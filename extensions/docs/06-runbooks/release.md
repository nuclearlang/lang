---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [../02-architecture/language-server.md, ../../vscode/AGENTS.md, ../../jetbrains/AGENTS.md, ../../zed/AGENTS.md]
---
# Release the extensions

Done after every change of the server, a client, the themes or the bundled dialects and type definitions, without
asking. The extensions carry the platform's one version: a release of them is a release of the whole platform
([ADR-platform-0011](../../../docs/03-adr/0011-one-version-one-release.md)).

## Steps

1. Raise the platform's version (minor for a feature, patch for a fix) with `installer/release/version.sh <version>`:
   it writes every project, these three extensions among them, and their lock files. Then the examples of each
   `README.md` that name a version, and the release of the whole platform
   ([the installer's runbook](../../../installer/docs/06-runbooks/release.md)): no tag before
   `installer/release/delivery.sh <version>` passes (it runs `npm run compile` and `npm test` here, the Spanish of
   every text and the settings with no local model among them), and `installer/release/after-release.sh <version>`
   after it.
2. Write the change in the `CHANGELOG.md` of each extension it reaches.
3. Build (the VS Code extension carries Nuclear Chat's UI: `nuclear-chat/ui/build-embed.sh` first, after `npm ci` in
   `nuclearlang/tools/node` and `installer/release/build-runtimes.sh`; the CI and the release do the same):

   ```sh
   nuclear-chat/ui/build-embed.sh                                      # → nuclear-chat/ui/build/app/dist-embed/embed.js
   (cd extensions/vscode && npm run package)                           # → nuclearlang-<version>.vsix
   (cd extensions/jetbrains && IDE_HOME=/opt/android-studio ./build.sh) # → build/nuclearlang-<version>.zip
   (cd extensions/zed && ./build.sh)                                    # builds and installs into Zed
   ```

4. Install: `installer/install.sh`. It installs the newest `.vsix` of `extensions/vscode/` (`sort -V`) and does not
   build one: without step 3 the previous version stays installed (0.52.1 was never packaged, so VS Code kept 0.52.0;
   the installer now says so). Check with `code --list-extensions --show-versions`. It rebuilds
   `nuclear-builder`, and runs `extensions/zed/build.sh` when Zed is installed (`--no-zed` skips it).
5. Tell the user to quit VS Code completely (*File → Exit*: a reload does not refresh a theme) and to install the zip
   in Android Studio (*Settings → Plugins → ⚙ → Install Plugin from Disk…*).
6. When `extensions/vscode/syntaxes/nuclear.tmLanguage.json` changed, copy it to
   [nuclearlang/nuclear-tmlanguage](https://github.com/nuclearlang/nuclear-tmlanguage), the public copy GitHub
   Linguist will read (it is written only here):

   ```sh
   git clone -q https://github.com/nuclearlang/nuclear-tmlanguage /tmp/tm && \
     cp extensions/vscode/syntaxes/nuclear.tmLanguage.json /tmp/tm/ && \
     git -C /tmp/tm commit -qam "The grammar of <version>" && git -C /tmp/tm push -q
   ```

## Backward compatibility (before every release)

A user updates over data an earlier version wrote. Before packaging:

1. Run the battery, from the tree's root, with a project of this machine's (read-only: the teams are read from a
   copy of `~/.config/nuclearlang/factory`, the `.bak` of each earlier version among them as `old-<id>`):

   ```sh
   extensions/scripts/compat-check.sh --real <a project folder>
   ```

   It ends `compat: all passed`, or stops at the first failure. It runs the fixtures of every earlier stored format
   through today's code:
   - the Builder's engine (`tools/nuclear-builder/tests/test_compat.nuc`, fixtures in its `tests/fixtures/compat/`):
     a team of each earlier shape (`teams/v1-roles.json` 0.58–0.61: `roles`, a preset's fields, `techLead` a role;
     `v1-personality.json` 0.62–0.65: names, personalities, temperaments; `v2-members.json` 0.66–0.69: `members`,
     free-word team skills, `extraSkills`; `v2-gone-values.json`: a temperament, a base agent, a provider, a kind,
     an employee and a tech lead that no longer exist, read with a warning each) through `team list|show --json`, `teamShown` and `chat-host`; run files
     of earlier engines (`runs/engine2.json`, the TypeScript engine's nine stages; `engine3-no-team.json` 0.58–0.60;
     `engine3-no-keys.json`) through `runs --json`, `run show|journal` and a retry from a station; the flat
     `specs/<id>/` through `spec list` and `spec migrate`; the line of earlier versions (`builder-json/`) through
     `line show|set` and the run's team; an older Builder chat (`builder-chat/`, `.nuclear/builder/chat/<id>.jsonl`); in each team and run of 0.69 and
     before, the role `delivery` read as `devops` (the member keeping its id; `test_teams.nuc` too);
   - Nuclear Chat's service (`nuclear-chat/nuclear_chat/test/chat_test.nuc`, `firstHistory`, fixtures in its
     `test/fixtures/compat/`): `channels.json` and the `.jsonl` histories of its first version;
   - the editors (`npm run test:compat` in `vscode/`, also part of `npm test`: `tools/nuclear-builder/test/compat.test.ts`,
     fixtures in `vscode/test/fixtures/compat/`): the run files on the page (outline, log, a step's tree, a title
     without `key` in English), every setting under an id that moved, the projects saved for every folder before
     0.63.0 and those each folder kept until 0.83 (`workspace-state-0.83.json`, `test/workspaces.test.ts`: they join the
     editor's global list), the welcome's state of earlier versions (`global-state-onboarding.json`: offered while never finished and
     opened from the offer, never asked again once declined or done).

   Each loads without an error, converts on read where its format changed (the original kept as `.bak`) and says
   the same things (names, members, skills, the words moved into the purpose).
2. A change of a stored format adds its fixture in the same change (the earlier shape, as a file under the tests'
   fixtures), and a line here if it needs a manual step.
3. Install over the previous version on this machine (`installer/install.sh` with the previous `.vsix` installed
   first when the change touches stored data) and open the Builder, the company screen and the chat with the
   user's real data, read-only.
4. What cannot be converted is told to the user (a notification with what to do), and recorded in the CHANGELOG.

## Verification

- `npm run package` and `jetbrains/build.sh` end with `nuclear-lsp --check-bundle`: a bundle whose dialects do not
  load fails the build.
- The JetBrains plugin installed unpacked is in `~/.local/share/Google/AndroidStudio2026.2.1/nuclearlang`.
- Zed reloads the extension by itself; if not, restart Zed.

## Not done yet

The marketplaces: the VS Code listing and the binaries for macOS and Windows are in the roadmaps
([common](../01-product/roadmap.md), [VS Code](../../vscode/docs/01-product/roadmap.md)). The public installers and
the release workflow are [the installer project](../../../installer/AGENTS.md)'s.
