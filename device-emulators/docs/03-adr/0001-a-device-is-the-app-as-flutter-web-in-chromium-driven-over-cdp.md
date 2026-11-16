---
status: accepted
date: 2026-11-03
deciders: Julian Molina
---
# ADR-0001: A device is the app as Flutter web in Chromium, driven over CDP; one backend, a panel, a window and a terminal as fronts

## Context and problem
Android Studio shows a running device inside the IDE (*Running Devices*). A Synapsis app in VS Code, or built from
a terminal, had no device of its own to run on: it needed an emulator, a phone or a plain browser tab beside the
tool. The question was what a device is, so that the editor and the command line show the same one.

## Decision
**A device is the app running as Flutter web in a Chromium browser, with the device emulated and driven through
the Chrome DevTools Protocol**: the screen's size and density, touch, orientation and the identity (user agent) of
a phone or a tablet; the frames come back as a screencast and input goes in as CDP events. The same list of devices
everywhere, the one of the browsers' device toolbar (iPhone, Pixel, iPad, Galaxy, laptop, responsive).

**In the editor** the app runs inside VS Code, like Android Studio's *Running Devices*: a Flutter *custom device*
(`synapsis`, "Synapsis device") shipped with the extension appears in the device picker; launching on it runs
the app on Flutter's `chrome` device with a headless Chromium, and the panel shows its screen and sends input over
CDP, with breakpoints, hot reload and hot restart. A device bar like the browsers' (the devices, zoom, rotation)
sits over Chrome's device mode.

**From the command line** `nuclear device [<device>]` runs the app in its own window, like an emulator, and
`nuclear terminal-device` shows it inside the terminal. Both share one backend (Flutter web in Chromium, the
emulation over CDP, input, hot reload); only the front changes. Several at once are numbered. The window takes the
device's ratio and at most 85 % of the screen's height; on a tiling window manager (Hyprland, Sway, i3) it floats.
The terminal draws with the best it supports: images (kitty, sixel), or colored blocks with the app's texts
written as letters in their exact place (given by the `synapsis` package in debug).

## Options considered
1. Flutter's `web-server` device for the editor's panel: no breakpoints.
2. An engine of our own, without a browser (flutter-pi as a guide): postponed.
3. Flutter's `chrome` device with a Chromium we drive over CDP. Chosen.

## Consequences
- Positive: a device starts with what a Flutter developer already has (Flutter and a Chromium browser), in the
  editor, in a window or in a terminal, several at once, with hot reload and the editor's debugger.
- Negative: it is Flutter web: no native plugins and no `dart:io`; a real phone is still needed for those. A device
  costs a `flutter run` and a browser in memory.

## References
- Replaces: ADR-0074, ADR-0081
- The Nuclear workspace of the editor, where several device panels run at once: `ADR-extensions-0002`.
