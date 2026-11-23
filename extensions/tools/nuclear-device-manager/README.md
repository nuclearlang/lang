# The devices in the editor

[![extension-vscode](https://github.com/nuclearlang/nuclearlang/actions/workflows/extension-vscode.yml/badge.svg)](https://github.com/nuclearlang/nuclearlang/actions/workflows/extension-vscode.yml) · [Website](https://nuclearlang.github.io/tools/devices)

Your app running inside VS Code, beside its code: the **Synapsis device** runs a mobile app in a panel, like Android
Studio's *Running Devices*; the **web device** shows a web app at desktop, laptop, tablet or phone size (`Ctrl+Alt+V`).

## Why

- You watch hot reload while you code, so the app belongs next to the code.
- Each device has its own size, identity and session: two users side by side are two tiled devices.
- Left out on purpose: VS Code only; elsewhere use [`nuclear device`](../../../device-emulators/AGENTS.md).

## How we made it

- A device is the app as Flutter web in a headless Chromium, driven over CDP ([ADR-devices-0001](../../../device-emulators/docs/03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md)).
- Several devices, parked, never lost; one idle for 30 minutes ends by itself ([ADR-extensions-0002](../../docs/03-adr/0002-the-nuclear-workspace.md)).
- Nothing stays alive when VS Code closes; a frame is the on-screen pixels 1:1.
- TypeScript, with the same presets as `nuclear device` ([roadmap](docs/01-product/roadmap.md)).

## Try it

Install the [VS Code extension](../../vscode/README.md) and the Dart and Flutter extensions, open a Synapsis mobile
project, press ▷ Run and pick a Synapsis device. The first build takes about a minute.

## Read next

- [The guide](docs/08-guides/README.md): devices, several at once, the web device
- [Architecture](docs/02-architecture/overview.md) · [Mobile device](docs/02-architecture/mobile-device.md) · [Web device](docs/02-architecture/web-device.md)
- [Roadmap](docs/01-product/roadmap.md) · [AGENTS.md](AGENTS.md) to change it
