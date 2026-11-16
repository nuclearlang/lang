---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../01-product/roadmap.md, ../03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md, ../../../nuclearlang/dialects/dart/docs/07-reference/flutter.md]
---
# The Synapsis devices

A Synapsis device runs a mobile app with the size, density, touch and identity of a phone or a tablet, without an
emulator. The app runs as Flutter web in a Chromium browser, and the device is emulated and driven over the Chrome
DevTools Protocol (CDP). From the command line a device is:

- **a window of its own** (`nuclear device`), like an emulator;
- **the terminal device** (`nuclear terminal-device`), the device's screen inside your terminal.

Both run inside a mobile project (a folder with `config.nuc`), build the app first, and can run several at once:
device 1, 2, 3. When a device ends, nothing stays alive: neither `flutter run` nor the browser.

A device is Flutter web: no native plugins, no `dart:io`. It is a fast test device, not a replacement for a real
phone. Why it is built this way: [ADR-devices-0001](../03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md).

## What it needs

- Flutter (`flutter run -d chrome`).
- A Chromium browser: Chrome, Chromium, Edge, Brave or Vivaldi. `CHROME_EXECUTABLE` chooses one:

  ```sh
  export CHROME_EXECUTABLE=/path/to/chrome
  ```

- Memory: in debug, about 1.4 GB for `flutter run` with its compiler and 0.9 GB for the browser, per device. On
  Linux each device's temporary files (about 500 MB) go to `~/.cache/dfly/<n>`, not to `/tmp`, and are deleted on
  close.

## The commands

```
device [<device>] [--landscape] [-- <args>] (dv) a test device in its own window, like an emulator (pixel7,
                                             iphone14pro, ipadair...; several at once: device 1, 2, 3)
device list                                the running devices and the devices it can be
terminal-device [<device>] [--render kitty|sixel|text|blocks]
                                      (td) the Synapsis Terminal device: the app inside this terminal
```

- `<device>`: a preset, by id or name (case, spaces and dashes are ignored). Default: `pixel7`.
- `--landscape`: start rotated.
- `-- <args>`: everything after `--` goes to `flutter run` (for example `-- --release`).
- `--render` (terminal device): how it draws; see below.

## The presets

`nuclear device list`, in a mobile project:

```sh
$ nuclear device list
no Synapsis device is running

devices:
  pixel7           Pixel 7 (412×915)
  iphone14pro      iPhone 14 Pro (393×852)
  iphonese         iPhone SE (375×667)
  iphone15promax   iPhone 15 Pro Max (430×932)
  galaxys20        Samsung Galaxy S20 Ultra (412×915)
  galaxya51        Samsung Galaxy A51/71 (412×914)
  ipadmini         iPad Mini (768×1024)
  ipadair          iPad Air (820×1180)
  ipadpro          iPad Pro (1024×1366)
  tabs7            Galaxy Tab S7 (800×1280)
  responsive       Responsive (400×800)
  laptop           Laptop (1280×800)
  desktop          Desktop (1920×1080)
```

The sizes are CSS pixels in portrait, the same list as the browsers' device toolbar and the editor's device panel.
Each preset also carries its density and its identity (an Android or iOS user agent).

## A device in its own window

```sh
nuclear device                 # a Pixel 7
nuclear dv iphone14pro         # an iPhone 14 Pro, in a second window beside the first
nuclear device ipadair --landscape
```

- The window has no browser bars, takes the device's ratio and at most 85 % of the screen's height. Several stay
  side by side. On Hyprland, Sway and i3 it floats instead of filling a tile.
- Its title is `Synapsis device N · <device> · <app>`. The mouse is a finger.
- The terminal behaves like `flutter run`'s: `r` hot reload, `R` hot restart, `q` quit. Closing the window also
  ends it.

## The terminal device

```sh
nuclear terminal-device                  # the best drawing the terminal supports
nuclear td iphonese --render blocks
```

The device's screen, with a frame, a status bar and Flutter's last message, inside the terminal:

| `--render` | Where |
|---|---|
| `kitty` | images in kitty, Ghostty and WezTerm |
| `sixel` | images in foot, Konsole, Windows Terminal, iTerm2 and mlterm |
| `text` | colored blocks (two pixels per cell) with the app's texts written as letters in their place, readable at any size: what GNOME Terminal, XFCE, LXQt, Alacritty, Terminal.app, the Linux console, Zed and VS Code get |
| `blocks` | the colored blocks alone, without the texts |

| Key or mouse | What it does |
|---|---|
| click and drag | tap and drag |
| wheel | scroll |
| right click, `b` | back |
| `r` / `R` | hot reload / hot restart |
| `o` | rotate |
| `d` / `D` | another device |
| `m` | another drawing mode |
| `s` | a screenshot, in the project's `build/screenshots/` |
| `l` | Flutter's log |
| `?` | help |
| `q`, Ctrl+C | quit |

Arrows, Enter and Tab go to the app. With a text field focused, keys are text (pasting too) and the commands go
with Alt (`Alt+r`); Esc leaves the field.

## In the editor

VS Code shows the same kind of device in a panel beside the code (the *Synapsis device*, with breakpoints and hot
reload), and a web project gets a web device driven over CDP the same way. Those are the editor's code:
[the extensions](../../../extensions/AGENTS.md).

## What ran

Tested on Linux with Hyprland. On macOS and Windows the devices compile but never ran; GNOME and KDE (the window's
placement) and real sixel terminals are untested: [the roadmap](../01-product/roadmap.md).
