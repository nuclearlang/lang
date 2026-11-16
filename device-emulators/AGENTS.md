# The devices

Test devices that run a mobile app with the size, density, touch and identity of a phone or a tablet, without an
emulator: the app runs as Flutter web in a Chromium browser driven over the Chrome DevTools Protocol. From the
command line a device is its own window (`nuclear device`) or lives inside the terminal
(`nuclear terminal-device`); the editors show the same kind of device in a panel.

## Stack

- Rust, the library crate `nuclear-devices` (`src/lib.rs`: `parse`, `list`, `presets_text`, `run`): `crossterm`
  (the terminal), `tungstenite` (the CDP WebSocket), `png`, `base64`, `serde_json`.
- Its caller: the `nuclear` command (`device` (dv), `device list`, `terminal-device` (td) in
  `tools/cli/src/framework/mod.rs`) builds the app, then calls `run`.
- At run time: Flutter (`flutter run -d chrome`) and a Chromium browser (Chrome, Chromium, Edge, Brave or Vivaldi;
  `CHROME_EXECUTABLE` chooses one).

## Commands

```sh
cargo test -p nuclear-devices               # the unit tests (arguments, presets, slots, render, window size)
cargo clippy --all-targets
cargo check -p nuclear-devices --target <windows or macos target>   # the only check those systems have had
nuclear device [<device>] [--landscape] [-- <flutter run args>]
nuclear device list                         # the running devices and the devices it can be
nuclear terminal-device [<device>] [--landscape] [--render kitty|sixel|text|blocks]
```

## Folders

- `src/lib.rs`: the arguments, the list, `run` (a slot, then the front).
- `src/backend.rs`, `cdp.rs`, `presets.rs`, `system.rs`: Flutter, the browser, CDP, the presets, the operating system.
- `src/window.rs`, `src/terminal/` (`mod.rs`, `caps.rs`, `render.rs`): the two fronts.
- `docs/`: this project's documents (the table below).

Not here: the text layer the terminal reads (`__synapsisTextLayer`) is the `synapsis` Dart package's
(`nuclear-synapsis-framework/platforms/mobile/packages/synapsis/`); the editors' device panels are their own code
(`extensions/tools/nuclear-device-manager/src/mobile-device.ts`, `web-device.ts`).

## Rules

1. **One backend, several fronts.** Flutter, the browser, CDP, emulation, input, frames and hot reload are
   `backend.rs`; a front (window, terminal) only shows the screen and sends input back (ADR-devices-0001).
2. **Nothing stays alive when a device ends**: neither `flutter run` nor the browser, whether the window is
   closed, `q` is pressed or the terminal hangs up. The terminal's raw mode is restored also on a panic.
3. **`render.rs` is pure** (no I/O) and tested; what depends on the operating system is only in `system.rs`.
4. **The presets are the same list as the editor's panel** (`presets.rs` and `extensions/tools/nuclear-device-manager/src/mobile-device.ts`): a
   device added to one is added to the other.
5. **A device is Flutter web**: no native plugins, no `dart:io`. It is not a replacement for a real phone.
6. What a user reads is the "Synapsis devices" part of the `nuclear` CLI section (§11) of
   `nuclearlang/dialects/dart/docs/07-reference/flutter.md`: a new device, key or render updates it.

## Documents

| Read | When |
|---|---|
| [docs/01-product/roadmap.md](docs/01-product/roadmap.md) | You look for what is untested (systems, desktops, terminals) or pending in the devices |
| [docs/02-architecture/overview.md](docs/02-architecture/overview.md) | You change the crate: the backend, the CDP client, the window placement, the terminal's rendering, the slots and temporary folders |
| [docs/03-adr/README.md](docs/03-adr/README.md) | You need why a device is Flutter web in a browser and not an engine of its own |

Elsewhere:

- What a user reads (the devices, the keys of the terminal device, the memory it takes):
  [the flutter reference](../nuclearlang/dialects/dart/docs/07-reference/flutter.md), §11.
- The device panels of the editors: [the extensions](../extensions/AGENTS.md).
- The command line they are part of: [the command line tools](../tools/cli/AGENTS.md).
