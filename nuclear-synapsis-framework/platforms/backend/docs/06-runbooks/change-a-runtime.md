---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../05-standards/testing.md, ../02-architecture/runtime-python.md, ../02-architecture/runtime-typescript.md]
---
# After changing a runtime

The steps after a change in `packages/synapsis-py` or `packages/synapsis-nest`. Commands run from the root of the
tree; the set-up is in [testing](../05-standards/testing.md).

## 1. The same behaviour in both runtimes

A behaviour of the platform exists in both packages, with the same test in both
(`packages/synapsis-py/tests/test_data.py`, `packages/synapsis-nest/test/data.test.ts`).

## 2. Build and install the changed runtime

- **`synapsis-py`** is installed in `nuclearlang/tools/python/.venv` with `pip install -e`: the venv reads the
  sources, nothing to repeat.
- **`synapsis-nest`** is compiled and copied, never linked. The nestjs check does both; by hand:

```sh
(cd nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest && npm install && npx tsc -p tsconfig.json)
(cd nuclearlang/tools/node && npm install --no-save --install-links ../../../nuclear-synapsis-framework/platforms/backend/packages/synapsis-nest)
```

  The install is repeated after every rebuild: a symlink would resolve the runtime's peers in its own
  `node_modules`, and two copies of `@nestjs/common` break `tsc`.

## 3. Run the checks

```sh
sh nuclear-synapsis-framework/platforms/backend/checks/fastapi-check/check.sh
sh nuclear-synapsis-framework/platforms/backend/checks/nestjs-check/check.sh
```

## 4. A changed public API: regenerate the type definitions

The compiler and the editors know the runtimes' names from their type definitions.

```sh
nuclearlang/tools/defs/python/generate.sh        # nuclearlang/dialects/python/defs/, from nuclearlang/tools/python/.venv
nuclearlang/tools/defs/typescript/generate.sh    # nuclearlang/dialects/typescript/defs/, from nuclearlang/tools/node/node_modules
```

Each script regenerates every package of its language with the versions installed there, the runtime among them
(`synapsis`, `synapsis-nest`). If a version changed, update the `defs` lists of the dialects
(`nuclearlang/dialects/python/dialect.toml` and `frameworks/fastapi/dialect.toml`;
`nuclearlang/dialects/typescript/frameworks/nestjs/dialect.toml`). Then `cargo test`.

## 5. Goldens, documents, the installed copy

- The generated output changed: `UPDATE_GOLDEN=1 cargo test`, and review the diff.
- A change a user can see: `docs/07-reference/backend.md` gets the Nuclear, each dialect's reference its output,
  `CHANGELOG.md` a line.
- `installer/install.sh`: the installed `nuclear` installs the runtimes into a project from the installation's
  `packages/`, so a project of the user sees the change only after it.

Publishing the packages (PyPI, npm) is not set up yet: [roadmap](../01-product/roadmap.md).
