---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/dependencies.md, ../05-standards/testing.md, ../../../../tools/defs/typescript/generate.sh]
---
# Runbook: the type definitions of TypeScript (`defs/`)

`defs/<package>/<version>/` (`package.toml`, `index.json`, `api.json`) is generated. Never edit it: regenerate it.
The format: [../../../../docs/07-reference/definitions.md](../../../../docs/07-reference/definitions.md).

## Regenerate the standard library and the `nestjs` packages

When a version in `nuclearlang/tools/node/package.json` changes, or the public API of the runtime `dragonfly-nest`
changes.

1. `nuclearlang/tools/node` is installed and has the current runtime in it: the backend platform's `nestjs` check
   installs it ([testing.md](../05-standards/testing.md)).
2. From anywhere: `nuclearlang/tools/defs/typescript/generate.sh`. It generates into a temporary folder with the
   versions installed in `nuclearlang/tools/node/node_modules` and copies the result into `defs/`:
   `typescript@<version>` (`--lib es2022`: the standard library, implicit), `rxjs`, `nestjs_common`, `nestjs_core`, `sequelize`,
   `sequelize_typescript`, `nestjs_sequelize`, `class_validator`, `class_transformer`, `nestjs_testing` and
   `dragonfly-nest` (`dragonfly-nest`, `dragonfly-nest/ai`, `dragonfly-nest/events`, `dragonfly-nest/testing`).
3. If a version changed, update `defs` in `frameworks/nestjs/dialect.toml` (and `typescript@...` in
   `frameworks/react/dialect.toml`).
4. `cargo test` from the root of the tree: it validates the dialects, and the goldens show whether an import
   changed.

## The `react` packages

`react`, `react_router`, `vitest`, `testing_library_react` and `dragonfly-web` are not written by `generate.sh`.
They are generated with `gen.js`, one call each in the style of `generate.sh`, from
`nuclearlang/tools/node/node_modules` (react and the test libraries are installed there; the runtime after its
build, copied in by the web platform's `react` check). Regenerate `dragonfly-web` after changing its public API;
the web platform's side of that procedure is
`nuclear-synapsis-framework/platforms/web/docs/06-runbooks/change-the-runtime.md`.

TODO(human): the five `gen.js` calls for the `react` packages (modules, `--depends`, descriptions) are recorded
nowhere in the tree. Should they be added to `generate.sh`?

## One package

`gen.js` writes one package (`nuclearlang/tools/defs/typescript/gen.js`):

```sh
node gen.js <name> <version> <out-root> [<module>...] [--depends a@1,b@2] [--lib es2022]
     [--description "..."] [--from <dir with node_modules>] [--package <installed package>]
```

It writes `<out-root>/typescript/<name>/<version>/`. Types are written in Nuclear notation. With no module named,
the module is the package itself (`--package @nestjs/axios`, whose definitions are called `nestjs__axios`).
`--from` defaults to `nuclearlang/tools/node`. A package's default export goes to `defaults` (`import x from 'x'`).

A package a dialect should know: install it in `nuclearlang/tools/node` (`package.json`), add its `gen` line to
`generate.sh` with the `--depends` of what it builds on, generate, and name it in the `defs` of the dialect that
uses it. Its place in the list matters: the first package that exports a name gives it.

## A project's own packages

Nothing here changes. `dragonfly add <package>` in a `nestjs` or `react` project runs the dialect's `[toolchain]`
(`package_add`, `package_version`, `package_companion`: the `@types/<name>` package of one that ships no types,
`package_defs`) and writes the package's definitions into the project's `defs/`.
