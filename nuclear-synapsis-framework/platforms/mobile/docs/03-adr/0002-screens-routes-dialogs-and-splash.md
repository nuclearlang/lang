---
status: accepted
date: 2026-11-16
deciders: Julian Molina
---
# ADR-0002: A screen is declared with `@screen`, navigation belongs to the views, and dialogs and the splash come from the runtime

## Context and problem

A screen has an address, the state managers it provides, a session it may require, an access rule, a place in a
tab bar, a way to come in. An app also needs dialogs that look alike and a first screen that covers its start. The
project must say all of it in a few words, and the architecture must keep navigation out of the domain.

## Decision

**One extensible decorator for screens.**
`@screen(route = "/", providers = [...], loggedIn = { forward: LoginScreen }, acl = { roles, permissions, guards, forward }, shell = { widget, tab }, notFound, transition = ScreenTransition.fade)`.
Its objects use `:`, like every Nuclear object. `forward` is required in `loggedIn` and in `acl` (`N0217`).

**Routes: go_router, always from the views.** Never from managers or use cases: `BuildContext`, `GoRouter` and
`appRouter` are used only in a `stateless` or a `stateful` (`N0301`).

**A transition per screen.** `transition` takes `ScreenTransition.fade`, `slide`, `up`, `scale` or `none`; without
it, the platform's. It is an enum: the editor completes it and the target checks it, and the name `Transition`
would clash with bloc's class.

**Nested routes with their own back.** A route is nested in the route with the longest address that starts its
own (never `/`). Going to it stacks the parent below, also from a link, so back returns to the parent. Inside a
`shell` tab it stays in that tab. No argument says it: the address already does.

**Dialogs.** `SynapsisDialog` is like a Bootstrap modal (header, body, footer), with the types info, success,
warning and danger in the color and icon of the app's theme, the sizes small, medium and large, and localized
Accept and Close. A dialog has an Accept button only with `onAccept`. `Popups.toast` and `Popups.snackbar` are for
messages that go away on their own.

**The splash comes in the package.** `SplashScreen` shows `child` for at least `minDuration` (3 s by default) and
until `onLoad` (the initial data) finishes; then it goes to `next` with the router. An error of `onLoad` shows
`onError` with `retry`; without `onError` it is logged and the app continues to `next`.

**The native splash is `@splash(color, image)`** on the splash screen. The project generates
`flutter_native_splash.yaml` and the CLI runs `flutter_native_splash:create` (Android, also 12+, iOS and web; on
Linux and Windows the window waits for the first frame). `startSynapsis()` removes the native splash on the first
frame; the route of the `@splash` screen is the initial one. Images in `assets/` are copied to the app.

## Options considered

1. `@route` + `@provider`, two decorators: replaced by the single `@screen`.
2. `transition = "fade"`, a text: no completion and no check until run time.
3. An explicit `parent` argument for nested routes: a second way to say what the address already says.

## Consequences

- Positive: everything about a screen is in one place and a new need is a new argument; the domain cannot navigate.
- Negative: a screen whose route is nested is built from the address when a child is opened, so its parameters
  must be in its route. `onLoad` has no timeout.

## References

- An async guard and the router: [ADR-mobile-0007](0007-accepted-rules-of-events-guards-forms-and-state.md).
- Behaviour: [runtime.md](../02-architecture/runtime.md); API: [synapsis.md §6](../07-reference/synapsis.md).
- Of the eleven rules accepted together, this ADR holds four: `forward` required in `acl`, the Accept button only
  with `onAccept`, a transition per screen, nested routes.
- Replaces: ADR-0055, ADR-0057, ADR-0059, ADR-0061, ADR-0063, ADR-0085
