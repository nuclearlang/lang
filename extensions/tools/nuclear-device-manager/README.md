# The devices in the editor

Your app running inside VS Code, beside its code. The **Synapsis device** runs a mobile app in a panel, like
Android Studio's *Running Devices*; the **web device** shows a web app at the size of a desktop, a laptop, a tablet
or a phone. The *Devices* tool of the Nuclear workspace (`Ctrl+Alt+V`) lists the open devices and opens as many as
you want.

## Why it exists

Hot reload is watched while you code, so the app belongs next to the code, not in another window. Each device
has its own size, identity, app and session, so two users signed in side by side are two devices, tiled like
emulators.

What it leaves out: it is VS Code only. In a terminal or another editor, `nuclear device` opens its own window, or
use `nuclear terminal-device`; those devices are the project
[`device-emulators/`](../../../device-emulators/AGENTS.md).

## How we made it

- **A device is the app as Flutter web in Chromium, driven over CDP**
  ([ADR-devices-0001](../../../device-emulators/docs/03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md)):
  Flutter runs the app on its `chrome` device in a headless Chromium (Chrome, Chromium, Brave, Edge or Vivaldi); the
  panel shows its screen and sends it your taps, wheel and keys. Breakpoints, hot reload and hot restart work as for
  any Flutter web app. A web app runs on its dialect's dev server.
- **Several devices, parked, never lost** ([ADR-extensions-0002](../../docs/03-adr/0002-the-nuclear-workspace.md)):
  the devices stay in the mobile workspaces and the Devices tool; elsewhere they are parked (the app keeps running
  headless). Closing a device's tab only hides it; a device nobody looks at for 30 minutes ends by itself.
- **Nothing stays alive when VS Code closes**: every process a device starts carries the window's marker and is
  reaped.
- **A frame is the device's on-screen pixels 1:1**: nothing is upscaled.
- **Written in TypeScript**, bundled by the VS Code extension, with the same presets as `nuclear device`; the web
  device's engine and the CDP client have no `vscode` import, so node runs them without the editor.

**State:** it works; hot reload of each device, the idle stop, park and unpark and the web device panel were never
tried in a running VS Code, and the watchdog has no Windows version ([roadmap](docs/01-product/roadmap.md)).

## Try it

Install the [VS Code extension](../../vscode/README.md) and the Dart and Flutter extensions. Open a Synapsis
mobile project and press ▷ Run: it asks which device to use; pick a Synapsis device. The first run builds Flutter web
and takes about a minute; the next ones are incremental. For a web project, ▭ Device opens the web device.

## Where to read next

| | |
|---|---|
| The Synapsis device, several devices, the web device | [docs/08-guides/README.md](docs/08-guides/README.md) |
| The panels, park and unpark, the watchdog | [docs/02-architecture/overview.md](docs/02-architecture/overview.md) |
| How a mobile app gets into a panel | [docs/02-architecture/mobile-device.md](docs/02-architecture/mobile-device.md) |
| The web device | [docs/02-architecture/web-device.md](docs/02-architecture/web-device.md) |
| What is pending | [docs/01-product/roadmap.md](docs/01-product/roadmap.md) |
| To change it | [AGENTS.md](AGENTS.md) |
