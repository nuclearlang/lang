# nuclear-device-manager

The devices inside the editor: the **Synapsis device** (a mobile app running in a panel of VS Code, like Android
Studio's Running Devices) and the **web device** (a web app beside its code, at the size of a desktop, a laptop, a
tablet or a phone), plus the *Devices* tool of the Nuclear workspace (`Ctrl+Alt+V`), which lists the open devices
and opens as many as wanted. It works. VS Code only.

The devices themselves are the project [`device-emulators/`](../../../device-emulators/AGENTS.md) (the crate
`nuclear-devices`, which `nuclear device` and `nuclear terminal-device` call). The panels of this tool carry their own engine in
TypeScript, with the same presets as the CLI's `nuclear device`.

## Where the code is
In this folder; the VS Code extension compiles and bundles `src/` (`extensions/vscode/tsconfig.json`).

| File | What it is |
|---|---|
| `src/mobile-device.ts` | the Synapsis device: the panels, the running apps, the Flutter custom device, the presets |
| `src/web-device.ts` | the web device's panel and its commands |
| `src/web-session.ts` | the web device's engine; no `vscode` import |
| `src/cdp.ts` | a small client of the Chrome DevTools Protocol; no `vscode` import |
| `src/launch-log.ts` | a launch's steps, the stall limit of each, the reason of a failure and the project's log `.nuclear/logs/run.log`; no `vscode` import |
| `test/launch-log.test.ts` | the log, the reason, the stall (node:test) |

## Stack
- TypeScript; CDP over node's WebSocket; a headless Chromium (Chrome, Chromium, Brave, Edge, Vivaldi)
- Flutter's `chrome` device for a mobile app; the dialect's dev server (Vite) for a web app
- The Dart and Flutter extensions of VS Code, for the debug session

## Commands
Run in `extensions/vscode/`: `npm run compile`, `npm test` (`test/launch-log.test.ts`). The panels have no test; the web device's engine can be run
with node without the editor ([testing](../../vscode/docs/05-standards/testing.md)).

## Rules
- Nothing stays alive when VS Code closes: every process a device starts carries the window's marker and is reaped.
- An app lives on its own: closing a device's tab only hides it. A run never replaces a running device.
- The devices belong to the mobile workspaces and the Devices tool; elsewhere they are parked, not ended.
- A frame matches the device's on-screen pixels 1:1: nothing is upscaled.
- `web-session.ts`, `cdp.ts` and `launch-log.ts` never import `vscode`.
- A launch never fails in silence: every step is shown on the device, a step without news past its limit is a
  failure, and every failure says why (its error lines), offers *Try again* and *Show the log*, and is written to
  the project's `.nuclear/logs/run.log`.
- The decisions: ADR-extensions-0002 (several devices, park, the web device), ADR-devices-0001 (the Synapsis device).

## Documents (read by task)
| You need… | Read |
|---|---|
| The panels, the running apps, park and unpark, the watchdog, the processes | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| How a mobile app gets into a panel: the custom device, the launch, the screencast, the input | [docs/02-architecture/mobile-device.md](docs/02-architecture/mobile-device.md) |
| The web device: its engine, its panel, its debugger | [docs/02-architecture/web-device.md](docs/02-architecture/web-device.md) |
| What a user reads: the Synapsis device, several devices, the web device | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The pending work, what was never tried | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| The Devices pane and the ▷ Run / ◉ Debug / ▭ Device pickers | [the workspace](../../vscode/docs/02-architecture/workspace.md) |
| The CLI's devices (`nuclear device`, `terminal-device`) | [`device-emulators/`](../../../device-emulators/AGENTS.md) |
