# Environments

[![extension-vscode](https://github.com/nuclearlang/nuclearlang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/extension-vscode.yml)

The settings of your app in every environment, without opening a `.env` file: each variable your code reads with
`env("NAME", "default")`, its value in development, staging, production (any name), where the value comes from, and
the required ones that have none.

## Why

- One look shows what a deploy is missing: a required variable without a value in the active environment is red,
  and `nuclear run` would refuse to start.
- Secrets stay in the system's keyring, typed in a masked field, never written to a file nor shown.
- A web or mobile build bakes the variables its code reads: the page marks them (`client`), so a secret never ends
  up in an app.

## Try it

```sh
nuclear env list           # the same table in the terminal
nuclear env set API_URL https://staging.example.com --env staging
```

In VS Code: the **ENV** tool of the Nuclear workspace (`Ctrl+Alt+Y`), or *Nuclear: Open Environments*.

## Read next

- [The guide](docs/08-guides/README.md) · [How it works](docs/02-architecture/overview.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
