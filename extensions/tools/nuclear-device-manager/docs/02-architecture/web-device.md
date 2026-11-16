---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [overview.md, ../01-product/roadmap.md, ../../../../vscode/docs/02-architecture/debugging.md]
---
# The web device (`web-device.ts`, `web-session.ts`, `cdp.ts`)

A web app of the web platform shown in the editor, beside its code, the way the Synapsis device shows a mobile
app (ADR-extensions-0002). One panel per project. Only its engine ran; the panel was never opened in a running
VS Code ([roadmap](../01-product/roadmap.md)).

Commands: `nuclear.webDevice.{open,debug,reload}`: ▭ Device, ◉ Debug and ↻ Reload of a web project.

## The engine (`web-session.ts`)

No `vscode` import. It:

- runs the app's dev server: `build/app/node_modules/.bin/vite`, on a free port of `127.0.0.1`;
- starts a headless Chromium with a profile of its own. `browserExecutable()` looks for `CHROME_EXECUTABLE`,
  Chrome, Chromium, Brave, Edge, Vivaldi;
- drives the page over CDP (`cdp.ts`, shared with `mobile-device.ts`):
  - `Emulation.setDeviceMetricsOverride`, touch and user agent per `WEB_PRESETS` (desktop, laptops, tablets,
    phones);
  - `setEmulatedMedia` (`prefers-color-scheme`);
  - `Network.emulateNetworkConditions` (`THROTTLES`: fast 4G, slow 3G, offline) and `setCacheDisabled`;
  - the screencast at the panel's density (zoom × `devicePixelRatio`);
  - input: the mouse on desktop presets, touch otherwise;
  - history, `captureScreenshot`, the url of the DevTools frontend;
- reports `Runtime.consoleAPICalled`, `exceptionThrown`, `Log.entryAdded` and the `Network.*` events.

## The panel (`web-device.ts`)

- The address bar: back, forward, reload (Shift: without cache), the app's address, the page in the user's browser,
  Chrome's DevTools of the page.
- The device bar: desktop, laptop, tablet and phone sizes (user agent and touch for tablets and phones), rotation,
  *Responsive* with any size, zoom (always sharp); the color scheme, the network throttling, no cache.
- A dock, filtered: the page's **Console** (errors counted; a line's source opens the generated file) and
  **Network** (method, status, address, type, size, time).
- A screenshot into `build/screenshots/`.

## The debugger

◉ Debug starts a `chrome` attach session of VS Code's JavaScript debugger on the device's CDP port, with `webRoot`
= the app. `debug.ts` then mirrors the `.nuc` breakpoints into the generated `.ts`
([debugging](../../../../vscode/docs/02-architecture/debugging.md)).

## Trying it without VS Code

Bundle a script that imports `web-session.ts` with esbuild and run it with node against a built app.
