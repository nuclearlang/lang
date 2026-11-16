#!/usr/bin/env bash
# Builds the NuclearLang plugin for Android Studio / IntelliJ without Gradle:
# compiles the Java sources against the installed IDE and zips the plugin with the language server,
# every dialect with its type definitions and the TextMate grammar.
#
#   IDE_HOME=/opt/android-studio ./build.sh      → build/nuclearlang-<version>.zip
#
# Install: Settings > Plugins > ⚙ > Install Plugin from Disk... > choose the zip.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
# the working tree's root, and the VS Code extension beside this one (the theme and the grammar)
repo="$(cd "$here/../.." && pwd)"
vscode="$here/../vscode"
ide="${IDE_HOME:-/opt/android-studio}"
version="$(grep -o '<version>[^<]*' "$here/resources/META-INF/plugin.xml" | cut -d'>' -f2)"
out="$here/build"
dist="$out/dist/nuclearlang"

[ -d "$ide/lib" ] || { echo "IDE not found in $ide (set IDE_HOME)"; exit 1; }

echo "== theme"
node "$vscode/theme/build.mjs"
node "$vscode/theme/icons.mjs"

echo "== language server"
(cd "$repo" && cargo build --release -p nuclear-lsp)
# code metrics defaults (resources/codemetrics-defaults.json) come from the server
node "$vscode/scripts/codemetrics-settings.mjs"

echo "== plugin classes (against $ide)"
rm -rf "$out"
mkdir -p "$out/classes" "$dist/lib" "$dist/server" "$dist/textmate/nuclear/syntaxes"
cp_ide="$ide/lib/*:$ide/plugins/textmate-plugin/lib/*:$ide/plugins/textmate-plugin/lib/modules/*"
javac --release 21 -nowarn -cp "$cp_ide" -d "$out/classes" $(find "$here/src" -name '*.java')
cp -r "$here/resources/." "$out/classes/"
(cd "$out/classes" && jar --create --file "$dist/lib/nuclearlang.jar" .)

echo "== server, dialects and TextMate bundle"
cp "$repo/target/release/nuclear-lsp" "$dist/server/"
# every dialect (each language with its frameworks and type definitions; its docs/ stays behind) and the contract of
# each platform
cp -r "$repo/nuclearlang/dialects" "$dist/server/dialects"
rm -rf "$dist"/server/dialects/*/docs
for p in "$repo"/nuclear-synapsis-framework/platforms/*/platform.toml; do
  name="$(basename "$(dirname "$p")")"
  mkdir -p "$dist/server/platforms/$name"
  cp "$p" "$dist/server/platforms/$name/"
done
# the bundled server must load its dialects without the repository
"$dist/server/nuclear-lsp" --check-bundle
# JetBrains cannot dim the code of an `@example` by context (VS Code does, in the theme): there it stays comment gray
node -e '
const fs = require("fs"), [src, dst] = process.argv.slice(1), g = JSON.parse(fs.readFileSync(src, "utf8"));
for (const p of g.repository["doc-tag"].patterns) if (p.contentName === "comment.example.nuclear") delete p.patterns;
fs.writeFileSync(dst, JSON.stringify(g, null, 2) + "\n");
' "$vscode/syntaxes/nuclear.tmLanguage.json" "$dist/textmate/nuclear/syntaxes/nuclear.tmLanguage.json"
# the Enter inside comments is NuclearCommentEnter's: the onEnterRules are left out so they never apply twice
node -e '
const fs = require("fs"), [src, dst] = process.argv.slice(1), c = JSON.parse(fs.readFileSync(src, "utf8"));
delete c.onEnterRules;
fs.writeFileSync(dst, JSON.stringify(c, null, 2) + "\n");
' "$vscode/language-configuration.json" "$dist/textmate/nuclear/language-configuration.json"
cat > "$dist/textmate/nuclear/package.json" <<'JSON'
{
  "name": "nuclear",
  "contributes": {
    "languages": [{ "id": "nuclear", "aliases": ["NuclearLang"], "extensions": [".nuc"], "configuration": "./language-configuration.json" }],
    "grammars": [{ "language": "nuclear", "scopeName": "source.nuclear", "path": "./syntaxes/nuclear.tmLanguage.json" }]
  }
}
JSON

(cd "$out/dist" && zip -qr "$out/nuclearlang-$version.zip" nuclearlang)
echo "built $out/nuclearlang-$version.zip"
