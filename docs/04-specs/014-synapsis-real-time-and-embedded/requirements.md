---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [tasks.md, ../013-nuclear-chat/requirements.md, ../../03-adr/0008-nuclear-chat-the-factorys-workplace.md]
---
# Spec 014: Synapsis in real time, and embedded — Requirements

## Goal

Nuclear Chat (spec 013) is made with Synapsis (the user, 2026-11-18). Synapsis lacks two things it needs, and any
product with live data or a host page needs too: a connection that pushes (WebSockets, configured like `Http`), and a `web` app that runs inside
another page (an editor's webview, a page of another site). They are added to the framework, for every dialect of
each platform, with the same Nuclear (rules 2 to 4 of the root `AGENTS.md`).

## Philosophy

- **The framework grows, the product does not work around it.** What a product needs and the framework lacks is a
  capability of the framework, documented, tested in every dialect, and then used.
- **One way to write it.** The protocol is configuration: the repository, the use case and the screen are the same
  over HTTP or WebSockets, for every dialect; an adapter under the repository carries the calls.

## Requirements

1. **WebSockets as a connection, by the framework's rules** (the user, 2026-11-18): real time is configured, not
   written. `config/project_config.nuc` (`appConfig`) or a component's `config` declares the connection
   (`Http(...)` today, a WebSocket connection beside it, with the same options: url, headers, timeout,
   interceptors); a `repository` keeps its decorators and is written as it is today, and an adapter under it
   carries its calls over the connection it is bound to. Changing a repository from HTTP to WebSockets is one line
   of config; the Nuclear of the repository, the use cases and the screens does not change. The repository also
   receives what the server pushes (a method that returns a stream of a model), over a connection that can push.
2. **The server side the same way**: a `backend` project serves its controllers over HTTP and, when its config
   says so, over WebSockets too, with the same controllers; a component publishes an event and the clients
   subscribed to it receive it. Same Nuclear for `fastapi` and `nestjs`.
3. **The embedded mode of `web`**: a `web` project builds as a bundle that mounts into an element of a host page
   (`mount(element, host)`), with no router of the browser's address (an in-memory one), its styles scoped, its
   theme from the host's CSS variables, and its requests going through the host when the host gives a bridge
   (a webview cannot reach the service with its own token). The normal app build is unchanged.
4. **Made with the tools**: `nuclear new`/`gen` know both (a stream route, an embedded build); the examples of each
   platform show them; the platforms' checks cover them in every dialect.
5. **Guards in `backend`** (found by Nuclear Chat, 2026-11-18): a route (and a stream) can require a token from a
   header and refuse a request with an `Origin` header, written once in Nuclear for every dialect, as a guard on a
   controller or the whole app; the token never in a query parameter (it would reach the access log). A local
   service that starts commands (the chat's responders) is never served without it.
6. **Documented and decided**: Synapsis ADRs for each, the platforms' references and guides, the knowledge base.

## Out of scope

- Server-sent events: WebSockets cover both ways; another protocol is one more adapter later.
- The `mobile` platform.
