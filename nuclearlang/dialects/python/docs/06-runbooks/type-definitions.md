---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/dependencies.md, ../05-standards/testing.md, ../../../../tools/defs/python/generate.sh]
---
# Runbook: the type definitions of Python (`defs/`)

`defs/<package>/<version>/` (`package.toml`, `index.json`, `api.json`) is generated. Never edit it: regenerate it.
The format: [../../../../docs/07-reference/definitions.md](../../../../docs/07-reference/definitions.md).

## Regenerate everything

When a version in `nuclearlang/tools/python/requirements.txt` changes, or the public API of the runtime
`synapsis-py` changes.

1. The virtual environment exists and has the runtime installed in it
   ([testing.md](../05-standards/testing.md), "Setting up the environment").
2. From anywhere: `nuclearlang/tools/defs/python/generate.sh`. It generates into a temporary folder with the
   versions installed in the environment and copies the result into `defs/`: `python@<major.minor>` (the standard
   library, `builtins` implicit), then each package of the `fastapi` dialect with its `--depends`, then `synapsis`
   (the runtime: `synapsis`, `synapsis.ai`, `synapsis.events`, `synapsis.testing`, `synapsis.validators`).
3. If a version changed, update `defs` in `dialect.toml` (`python@...`) and in `frameworks/fastapi/dialect.toml`.
4. `cargo test` from the root of the tree: it validates the dialects, and the goldens show whether an import
   changed.

## One package

`gen.py` writes one package (`nuclearlang/tools/defs/python/gen.py`, run with the environment's Python):

```sh
gen.py <name> <version> <out-root> <module>... [--depends a@1,b@2] [--implicit builtins]
       [--description "..."] [--distribution <installed package>]
```

It writes `<out-root>/python/<name>/<version>/`. A name is exported by the first module of the list that has it;
only objects defined inside the package (or re-exported by it) are kept. With `--distribution` and no module, the
modules are the ones that package installs (`python-slugify` → `slugify`).

A package the dialect should know: install it in the environment (`requirements.txt`), add its `gen` line to
`generate.sh` with the `--depends` of what it builds on, generate, and name it in the `defs` of the dialect that
uses it.

## A project's own packages

Nothing here changes. `nuclear add <package>` in a `fastapi` project runs the dialect's `[toolchain]`
(`package_add`, `package_version`, `package_defs`) and writes the package's definitions into the project's `defs/`.
