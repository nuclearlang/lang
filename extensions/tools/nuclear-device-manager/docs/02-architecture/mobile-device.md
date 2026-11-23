---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../01-product/roadmap.md, ../../../../vscode/docs/02-architecture/client.md]
---
# The Synapsis device (`mobile-device.ts`)

The app running inside VS Code, like Android Studio's Running Devices (ADR-devices-0001). Flutter runs it on its
`chrome` device with a headless Chromium, so it is debugged like any web app (breakpoints, hot reload, hot
restart); the panel shows the browser's screen and sends the user's input back.

## The custom device

Only VS Code lists it: a Flutter custom device with the id `synapsis`, which the extension registers by itself.

- `ensureDevice`: `nuclear flutter custom-devices add --json` with `FLUTTER_CUSTOM_DEVICES=true`.
- Custom devices are on only where `FLUTTER_CUSTOM_DEVICES=true`: the extension adds it to the user's `dart.env`
  (and `CHROME_EXECUTABLE` if needed), then `_dart.reloadExtension`. A `configurationDefaults` value for `dart.env`
  does NOT reach the Dart extension, so it is written. `flutter devices` in a terminal and other IDEs do not show
  the device.

## The launch

The launch goes through `startDart` (`vscode/src/extension.ts`): the Dart extension is activated first (it starts by
itself only when a `pubspec.yaml` is at most two folders deep, and a Synapsis app is `<project>/build/app`; without
it VS Code refuses the `dart` launch in silence).

A launch never fails in silence (`launch-log.ts`). The device shows its steps — building the Nuclear project (▷ Run),
starting Flutter (the config resolved), compiling the app (the session started), opening the app (the page's CDP
connected), running (the first frame). A step without news (a step or a line of Flutter's output, read by a debug
adapter tracker of `dart`) longer than its limit (`STALL_MS`: 5 min build, 90 s Flutter, 6 min compile, 2 min
opening) ends the launch as stuck. Flutter ending before the first frame, a build error (`showBuildError`), a
missing Flutter extension or a refused launch (`nuclear.deviceLaunchFailed`) show on the device the message, the
output lines that explain it (`reason`), *Try again* and *Show the log*. The build's output, the launch's steps,
Flutter's output and every failure go to the project's `.nuclear/logs/run.log` (timestamped, kept under 1 MB),
which outlives the window: a person or an agent reads it after a failure.

`launchProvider` is the `resolveDebugConfiguration` of `dart` (a `-d` in `toolArgs` does NOT work). It sets:

- `deviceId: 'chrome'`, `--web-port`, `--web-browser-debug-port`;
- `--web-browser-flag=--headless=new`, `--enable-unsafe-swiftshader`;
- `--web-launch-url http://127.0.0.1:<port>/assets/__synapsis_device__`: an empty 404 page that carries the
  process marker (`about:blank` does not work).

Flutter's `web-server` device is rejected: its debug service has no breakpoints.

## The page in the panel

`attach` opens the extension's own CDP connection (over node's WebSocket):

- **`emulate`**: metrics, touch and user agent of the preset, so Flutter behaves as on iOS or Android and every
  input lands where it is drawn. The first time it is a `Page.navigate` already emulated; later a `Page.reload`,
  only if the platform changes.
- **The screencast**: `Page.startScreencast` (also on `Page.loadEventFired`), jpeg 100, at `r.density` = the
  physical pixels the panel shows the screen at. The webview reports `shot` = CSS width × zoom × `devicePixelRatio`
  in its `size` message; `sized` sets `density = max(dpr, shot / width)`, capped at 4, and only ever raises it,
  emulating again. Before the first measurement it falls back to `captureScale(p)`. So a frame matches the device's
  on-screen pixels 1:1 and nothing is upscaled (a 2x cap, and even the full `dpr`, blurred phones zoomed on a HiDPI
  screen).
- **Input**: `Input.dispatchTouchEvent` / `MouseEvent` / `KeyEvent`.
- It reconnects (`cdp.onclose`, 10 tries) and emulates again when a frame's size differs (every 2 s at most).
- `closeBrowser` at the end.

## The panel

- Its width is saved per screen width (`nuclear.device.widths`; by default 20 % of the screen, between 340 and
  540).
- *Fit* goes up to zoom 1.5.
- `lockDeviceGroup` locks its editor group, and only it: VS Code locks the active group, so the device is revealed and
  the lock waits (up to a second) until the device's group is the active one; never the user's editor group.
- A device can also be opened in the user's browser (`external`).

## Hot reload

Saving a `.nuc` builds and calls `flutter.hotReload` on the running session
([the client](../../../../vscode/docs/02-architecture/client.md)).
