# The devices

[![ci](https://github.com/nuclearlang/lang/actions/workflows/ci.yml/badge.svg)](https://github.com/nuclearlang/lang/actions/workflows/ci.yml) · [Website](https://nuclearlang.github.io/tools/devices)

Test devices for a Synapsis mobile app without an emulator: the app runs as Flutter web in Chromium, with a phone's
size, density and touch, in its own window (`nuclear device`) or inside the terminal (`nuclear terminal-device`).

## Why

- Needs only what a Flutter developer has: Flutter and a Chromium browser.
- Several devices at once, with hot reload.
- A fast test device, not a real phone: no native plugins, no `dart:io`.

## How we made it

- **Flutter's `chrome` device driven over CDP**: emulated screen, screencast frames, CDP input
  ([ADR-devices-0001](docs/03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md)).
- **One backend, several fronts**: the window and the terminal only show the screen and send input.
- **The terminal draws with the best it supports**: kitty, sixel or colored blocks.
- **Written in Rust** (`nuclear-devices`); nothing stays alive when a device ends.

## Try it

```sh
nuclear device list                    # the presets: pixel7, iphone14pro ... 13 in all
nuclear device                         # a Pixel 7 in its own window: r hot reload, q quit
nuclear td iphonese --render blocks    # an iPhone SE inside this terminal
```

Tested on Linux only ([roadmap](docs/01-product/roadmap.md)).

## Read next

- [The guide](docs/08-guides/README.md)
- [How it is built](docs/02-architecture/overview.md), [the decisions](docs/03-adr/README.md)
- [`nuclear`](../tools/cli/README.md), the command it is part of
- To change it: [AGENTS.md](AGENTS.md)
