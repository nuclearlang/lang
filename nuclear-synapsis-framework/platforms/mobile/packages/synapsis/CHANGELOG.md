## Unreleased

- `Exact`, `BigIntJson`, `BigDoubleJson`: Nuclear's exact numbers in JSON (texts both ways); `LocalTable(exact:)`
  compares and sorts their text by value; `Rules.bigint`, `Rules.bigdouble`, `Rules.minExact`, `Rules.maxExact`,
  `Rules.asBigInt`, `Rules.asBigDouble`. Depends on `decimal`.

## 0.1.0

- Debug builds on the web expose `globalThis.__synapsisTextLayer()`: the visible texts with their place, color
  and weight, for the Synapsis Terminal device (`nuclear terminal-device`).
- `Log.d/i/s/w/e`: one readable block per log (breadcrumb `at`, time, message, data as JSON, error, stack
  and the source line), a pastel color per component (`LogColor`, `ComponentConfig.logColor`); `Log.sink`
  receives a `LogEntry`.

- `SplashScreen`: the first screen; shows its child for a minimum time (3 s) and until `onLoad`
  finishes, then goes to `next` with the router; `onError` with `retry`.
- First release: `Http` and `WebSocket` connections, `Repository` (path parameters, query, body, cache
  with TTL and purge, retries with backoff), `HttpInterceptor` and `EventInterceptor`, `StateManager`.
- Global events delivered on demand (`Events.publish` / `Events.subscribe`, `EventBuilder`,
  `EventListener`, `EventsOnDemand`): only the visible screen updates, a hidden one gets the last event
  when it is visible again; background isolates of the app can publish.
- `SessionManager` (`start<T>`, `get<T>`, `set`/`value`/`remove`, `destroy`; typed data in secure
  storage, restored on the next run), `GlobalEvents<T>`, `SessionInterceptor`.
- `Acl` (inherited roles, permissions per role), `AclRule`, `Guard`, `AclBuilder`, `Guards`.
- `synapsisRouter` and `AppRoute` (go_router): navigation by screen (`context.goTo`, `pushTo`,
  `goBack`), path and query parameters, tabs, a not-found page, session and ACL redirects.
- `NetworkManager`, `Log` and `SynapsisTest`.
- Forms: `Rules`, `FormManager<F>` (remote checks with debounce), `SynapsisForm`, `FormTextField`,
  `FormCheckbox`, `FormInput`, `FormSubmit`; `Validators` for a plain `TextFormField`.
- Dialogs: `SynapsisDialog` (`info`, `success`, `warning`, `danger`; header, body, footer; sizes; auto
  close), `Popups.alert/confirm/show/loading/toast/snackbar`, `PopupTheme`.
- `Translations`: JSON dictionaries per component and locale, `String.tr`, remote dictionaries saved per
  version.
