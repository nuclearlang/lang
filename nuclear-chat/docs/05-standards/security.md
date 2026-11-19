---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../02-architecture/api.md, ../02-architecture/responders.md, ../../../nuclear-graph-storage/docs/05-standards/security.md]
---
# Security

Never weaken one of these rules to make something easier.

- **A route can start a command** (a member's responder, given at registration). So the service listens on
  `127.0.0.1` only and every route, and the WebSocket's upgrade, is guarded (ADR-synapsis-0007): the header
  `X-Chat-Token` must carry the service's token (401), and a request with an `Origin` header (a web page) is refused
  (403). Never a query parameter, which reaches the access log. An unset token refuses every request.
- **The service's token** is made once (`secrets`, 32 bytes) by `nuclear-chat serve` and kept only in the system's
  keyring (service `nuclear-chat`, account `token`), as the Smart Graph keeps its owner token, never in a file:
  `~/.config/nuclearlang/nuclear-chat.json` only notes that one is kept, so a keyring closed at login is waited for
  (90 s) and then refused, never answered with a second token. The service gets it in its environment
  (`NUCLEAR_CHAT_TOKEN`); a host gets it from `nuclear-chat connect --json` (the editors' extension host only). No
  keyring on the machine: the service does not start.
- **A responder runs in the project's folder** with the service's user; the chat gives it the conversation, never
  a key. A paid provider's money is the responder's (two confirmations, spec 011).
- **A GIF service's key** is kept in the system's keyring (service `nuclear-chat`, account `tenor` or `giphy`), read
  from stdin by `nuclear-chat gif-key`, never from the command line (but macOS's `security`, a `shortcut:` in
  `system/keyring.nuc`). It never reaches a file of the project, an answer or an event. Tenor and Giphy take it as a
  query parameter of their own API: a failed search answers `note: "failed"`, never the service's error, which
  holds the URL.
- **The search words leave the machine** only when the workspace's setting names a service and the project said
  yes once (`gifs.json`).
- **A file name from outside** is never a path: a channel's id is `[a-z0-9][a-z0-9_.-]*`, a pack drawing is
  `[a-z0-9-]+.svg` inside the pack.
