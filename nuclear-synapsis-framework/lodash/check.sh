#!/usr/bin/env bash
# Builds the library and its tests for every language dialect, checks the generated code with the target's own
# tools (tsc --strict with no unused local, dart analyze with no warning, pyright), runs each test/<name>_test.nuc
# and compares what it prints with test/<name>.out: every line `ok`, the same text in TypeScript, Dart and Python.
#   nuclear-synapsis-framework/lodash/check.sh [name...]     (UPDATE=1: the TypeScript output becomes the expected one)
# Needs what nuclearlang/tools/stdlib-check.sh needs: node, dart, nuclearlang/tools/node and nuclearlang/tools/python/.venv.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="${NUCLEAR_ROOT:-$(cd "$here/../.." && pwd)}"
lang="$root/nuclearlang"
DART="${DART:-$(command -v dart || echo "${FLUTTER_ROOT:-$HOME/develop/flutter}/bin/dart")}"
TSC="${TSC:-$lang/tools/node/node_modules/typescript/bin/tsc}"
PY="${PY:-$lang/tools/python/.venv/bin/python3}"
PYRIGHT="${PYRIGHT:-$lang/tools/python/.venv/bin/pyright}"
(cd "$root" && cargo build -q --bin nuclear) || exit 2
NUC="$root/target/debug/nuclear"
OUT="$(mktemp -d)"
ROOT_OUT="$OUT"
trap 'rm -rf "$ROOT_OUT"' EXIT
names=("$@")
[ ${#names[@]} -gt 0 ] || names=($(ls "$here"/test/*_test.nuc | xargs -n1 basename | sed 's/_test\.nuc$//'))
fail=0
ROOT_OUT="$OUT"
# twice: `library` builds src/ and test/ together (the helpers as a project's own code); `native` builds test/ alone,
# so every helper is the language's own: no `use`, brought by the compiler into one generated file
for mode in library native; do
OUT="$ROOT_OUT/$mode"
# a copy of the project per dialect: the sources never change, only the dialect of its nuclear.toml
for d in typescript dart python; do
  mkdir -p "$OUT/$d" && cp -r "$here/nuclear.toml" "$here/test" "$OUT/$d/"
  [ "$mode" = native ] || cp -r "$here/src" "$OUT/$d/"
  sed -i "s/^dialect = .*/dialect = \"$d\"/" "$OUT/$d/nuclear.toml"
  if ! "$NUC" build "$OUT/$d" -o "$OUT/$d/build" > "$OUT/$d/build.txt" 2>&1; then
    cat "$OUT/$d/build.txt"; echo "FAIL  build $d ($mode)"; fail=1
  fi
done
# the targets' own checkers, over the whole library
ts="$OUT/typescript/build"
if (cd "$ts" && node "$TSC" --strict --noUnusedLocals --noImplicitReturns --target es2022 \
     --module es2022 --moduleResolution bundler --lib esnext,dom --outDir js $(find . -name '*.ts' -not -path './js/*')); then
  echo "ok    checker typescript ($mode)"
else
  echo "FAIL  checker typescript ($mode)"; fail=1
fi
echo '{"type":"module"}' > "$ts/js/package.json"
# the compiled files import each other without an extension: node needs it
find "$ts/js" -name '*.js' -exec sed -i -E "s#from '(\.[^']*)'#from '\1.js'#" {} +
dt="$OUT/dart/build"
printf 'name: nuclear_lodash\nenvironment:\n  sdk: ">=3.0.0 <4.0.0"\n' > "$dt/pubspec.yaml"
if (cd "$dt" && "$DART" pub get --offline > /dev/null 2>&1 && "$DART" analyze --fatal-warnings lib > analyze.txt 2>&1); then
  echo "ok    checker dart ($mode)"
else
  grep -E '^ *(error|warning) -' "$dt/analyze.txt"; echo "FAIL  checker dart ($mode)"; fail=1
fi
py="$OUT/python/build"
if (cd "$py" && "$PYRIGHT" --pythonpath "$PY" app | tail -1 | grep -q "^0 errors"); then
  echo "ok    checker python ($mode)"
else
  (cd "$py" && "$PYRIGHT" --pythonpath "$PY" app | grep -E 'error' | head -20); echo "FAIL  checker python ($mode)"; fail=1
fi
for n in "${names[@]}"; do
  want="$here/test/$n.out"
  printf 'import { main } from "./test/%s_test.js";\nawait main();\n' "$n" > "$ts/js/run_$n.js"
  [ -z "${UPDATE:-}" ] || [ "$mode" = native ] || node "$ts/js/run_$n.js" > "$want"
  printf "import 'package:nuclear_lodash/test/%s_test.dart' as t;\nvoid main() => t.main();\n" "$n" > "$dt/run_$n.dart"
  for d in typescript dart python; do
    case $d in
      typescript) node "$ts/js/run_$n.js" > "$OUT/$n.$d.txt" 2>&1 ;;
      dart) (cd "$dt" && "$DART" run "run_$n.dart") > "$OUT/$n.$d.txt" 2>&1 ;;
      python) (cd "$py" && "$PY" -I -c "import sys; sys.path.insert(0, '.'); from app.test.${n}_test import main; main()") > "$OUT/$n.$d.txt" 2>&1 ;;
    esac
    if diff "$want" "$OUT/$n.$d.txt" > "$OUT/$n.$d.diff" && ! grep -q '^FAIL' "$want" && [ -s "$want" ]; then
      echo "ok    $n $d ($mode, $(grep -c '^ok' "$want") cases)"
    else
      grep "^>" "$OUT/$n.$d.diff" | head -12; grep '^FAIL' "$want" | head -12; echo "FAIL  $n $d ($mode)"; fail=1
    fi
  done
done
done
exit $fail
