# The devices

Test devices for a Synapsis mobile app, without an emulator: the app runs as Flutter web in a Chromium browser,
with the size, density, touch and identity of a phone or a tablet, driven over the Chrome DevTools Protocol (CDP).
From the command line a device is a window of its own (`nuclear device`) or lives inside the terminal
(`nuclear terminal-device`).

## Why it exists

A Synapsis app built from a terminal or opened in an editor had no device of its own: it needed an emulator, a
phone or a plain browser tab beside the tool. A device starts with what a Flutter developer already has (Flutter
and a Chromium browser), several at once, with hot reload, in a window, in a terminal, or in the editor's panel.

What it leaves out on purpose: it is Flutter web, so no native plugins and no `dart:io`. It is a fast test device,
not a replacement for a real phone.

## How we made it

The decision is [ADR-devices-0001](docs/03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md):

- **A device is Flutter's `chrome` device with a Chromium we drive over CDP**: the screen is emulated, the frames
  come back as a screencast and input goes in as CDP events. Flutter's `web-server` device was rejected (no
  breakpoints); an engine of our own, without a browser, is postponed.
- **One backend, several fronts.** Flutter, the browser, CDP, emulation, input, frames and hot reload are one
  backend; a front (the window, the terminal) only shows the screen and sends input back. The editor's device
  panel is the same idea in [the extensions](../extensions/AGENTS.md).
- **The same list of devices everywhere**: the browsers' device toolbar (Pixel, iPhone, iPad, Galaxy, laptop,
  responsive), shared with the editor's panel.
- **The terminal draws with the best it supports**: images (kitty, sixel), or colored blocks with the app's texts
  written as letters in their exact place, given by the `synapsis` package in debug.
- **Nothing stays alive when a device ends**: neither `flutter run` nor the browser.
- **Written in Rust**, the library crate `nuclear-devices`, which the `nuclear` command calls after it builds the
  app.

## Try it

Inside a mobile project (a folder with `config.nuc`), with Flutter and a Chromium browser (Chrome, Chromium, Edge,
Brave or Vivaldi; `CHROME_EXECUTABLE` chooses one):

```sh
nuclear device list            # no Synapsis device is running
                               # devices:
                               #   pixel7           Pixel 7 (412×915)
                               #   iphone14pro      iPhone 14 Pro (393×852)   ... 13 presets
nuclear device                 # a Pixel 7 in its own window: r hot reload, R hot restart, q quit
nuclear td iphonese --render blocks    # an iPhone SE inside this terminal
```

In debug a device takes about 1.4 GB for `flutter run` and 0.9 GB for the browser. It was tested on Linux with
Hyprland; on macOS and Windows it compiles but never ran ([the roadmap](docs/01-product/roadmap.md)).

## Where to read next

- [The guide](docs/08-guides/README.md): the presets, the window, the terminal device's renders and keys.
- [How it is built](docs/02-architecture/overview.md), [the decisions](docs/03-adr/README.md).
- The command it is part of: [`nuclear`](../tools/cli/README.md). To change it: [AGENTS.md](AGENTS.md).
