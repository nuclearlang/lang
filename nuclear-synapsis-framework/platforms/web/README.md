# Dragonfly web

The web platform of Dragonfly: single-page apps written in Nuclear with the same words as the mobile platform. Its
dialect `react` (React 19, React Router, Vite, Vitest) and its TypeScript runtime `dragonfly-web`.

Start with the rules of the platform, [docs/07-reference/web.md](docs/07-reference/web.md), and the guide of the
dialect, [react](../../../nuclearlang/dialects/typescript/docs/08-guides/react.md).

## What is inside

`platform.toml` (the contract every web dialect implements), `packages/dragonfly-web` (the runtime), `examples/`
(the `characters` app), `checks/react-check`, `docs/`.

The dialect is in `nuclearlang/dialects/typescript/frameworks/react/`, with the type definitions of React and its
tools beside it (`nuclearlang/dialects/typescript/defs/`).

## Working on it

It is built by the `nuclear` compiler and the `dragonfly` CLI of the same tree. From the root of the tree:

```sh
(cd nuclearlang/tools/node && npm install)                    # the shared Node tools of the check
installer/install.sh
```

The commands, the rules and the check before a change: [AGENTS.md](AGENTS.md) and
[docs/05-standards/testing.md](docs/05-standards/testing.md).

## License

[Apache-2.0](../../../LICENSE). By contributing you agree that your contribution is licensed under it.
