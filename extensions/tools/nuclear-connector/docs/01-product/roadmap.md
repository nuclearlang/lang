---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../../../../vscode/docs/01-product/roadmap.md, ../../../../jetbrains/docs/01-product/roadmap.md]
---
# Roadmap of Nuclear Connector

## Untested

- The Connector workspace in a running VS Code: the tree, also with projects opened as tabs; the component tabs; a
  request sent; the panels restored after a switch of workspace; *Update* of a contract; the environments.
- The *Nuclear Connector* tool window in a running IDE (only compiled, against Android Studio 2026.2).

## Pending

- **More protocols** (the user's plan): the tool must support http, sockets, grpc and udp. Today it sends only
  HTTP requests (GET, POST, PUT, PATCH, DELETE).
  `TODO(human): what does each protocol need (a tree of its own, a contract, a panel), and in which order?`
