# The devices

Test devices that run a mobile app with the size, density, touch and identity of a phone or a tablet, without an
emulator: the app runs as Flutter web in a Chromium browser driven over the Chrome DevTools Protocol. From the
command line a device is its own window (`dragonfly device`) or lives inside the terminal
(`dragonfly terminal-device`); the editors show the same kind of device in a panel.

## Where it is today

This folder holds only documents. The code is still inside the CLI crate and moves here in spec 008, T4.1
([tasks](../docs/04-specs/008-restructure/tasks.md)):

| Part | Where it is today |
|---|---|
| The device of the command line: backend, window, terminal | `nuclear-synapsis-framework/cli/src/device/` |
| The commands `device` (dv), `device list`, `terminal-device` (td) | `nuclear-synapsis-framework/cli/src/main.rs` |
| The text layer the terminal reads (`__dragonflyTextLayer`) | the `dragonfly` Dart package, `nuclear-synapsis-framework/platforms/mobile/packages/dragonfly/` |
| The editors' device panels (their own code, the same presets) | `extensions/vscode/src/device.ts`, `webDevice.ts` |

## Stack

- Rust, inside the `dragonfly` crate: `crossterm` (the terminal), `tungstenite` (the CDP WebSocket), `png`,
  `base64`. They take the binary from 4.1 to 5.3 MB.
- At run time: Flutter (`flutter run -d chrome`) and a Chromium browser (Chrome, Chromium, Edge, Brave or Vivaldi;
  `CHROME_EXECUTABLE` chooses one).

## Commands

```sh
cargo test -p dragonfly device                # the device's unit tests (arguments, presets, slots, render, window size)
cargo clippy --all-targets
cargo check -p dragonfly --target <windows or macos target>   # the only check those systems have had
dragonfly device [<device>] [--landscape] [-- <flutter run args>]
dragonfly device list                         # the running devices and the devices it can be
dragonfly terminal-device [<device>] [--landscape] [--render kitty|sixel|text|blocks]
```

## Rules

1. **One backend, several fronts.** Flutter, the browser, CDP, emulation, input, frames and hot reload are
   `backend.rs`; a front (window, terminal) only shows the screen and sends input back (ADR-devices-0001).
2. **Nothing stays alive when a device ends**: neither `flutter run` nor the browser, whether the window is
   closed, `q` is pressed or the terminal hangs up. The terminal's raw mode is restored also on a panic.
3. **`render.rs` is pure** (no I/O) and tested; what depends on the operating system is only in `system.rs`.
4. **The presets are the same list as the editor's panel** (`presets.rs` and `extensions/vscode/src/device.ts`): a
   device added to one is added to the other.
5. **A device is Flutter web**: no native plugins, no `dart:io`. It is not a replacement for a real phone.
6. What a user reads is the "Dragonfly devices" part of the `dragonfly` CLI section (§11) of
   `nuclearlang/dialects/dart/docs/07-reference/flutter.md`: a new device, key or render updates it.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is untested (systems, desktops, terminals) or pending in the devices |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change `device/`: the backend, the CDP client, the window placement, the terminal's rendering, the slots and temporary folders |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why a device is Flutter web in a browser and not an engine of its own |

Elsewhere:

- What a user reads (the devices, the keys of the terminal device, the memory it takes):
  [the flutter reference](../nuclearlang/dialects/dart/docs/07-reference/flutter.md), §11.
- The device panels of the editors: [the extensions](../extensions/AGENTS.md).
- The command line they are part of: [the command line tools](../tools/cli/AGENTS.md).
