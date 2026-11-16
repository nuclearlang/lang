---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [nuclear-synapsis-framework/cli/src/device/, nuclearlang/dialects/dart/docs/07-reference/flutter.md, device-emulators/docs/03-adr/0001-a-device-is-the-app-as-flutter-web-in-chromium-driven-over-cdp.md]
---
# The devices: overview

`dragonfly device` (dv, `window.rs`) and `dragonfly terminal-device` (td, `terminal/`) run on the same backend. The
command builds the app first (`dragonfly build`), then `device::run` takes a slot and starts the front. Several run
at the same time: device 1, 2, 3.

```
 mod.rs    parse (<device> --landscape --render -- <flutter args>), list, run
   │
   ├── window.rs      the device in its own window          ┐
   ├── terminal/      the device inside the terminal        ┘ fronts
   │
   └── backend.rs ──► flutter run -d chrome ──► Chromium ◄── cdp.rs (WebSocket)
                       presets.rs (size, density, touch, user agent)     system.rs (browser, ports, slots, processes)
```

## Modules (`nuclear-synapsis-framework/cli/src/device/`)

- **`backend.rs`**: `flutter run -d chrome` with `--web-launch-url` to an empty 404 page marked
  `__dragonfly_device_<n>_<pid>__` (the window is named so on Wayland, and the mark names the processes); the CDP
  connection to that page; `emulate` (size, density, touch, orientation, user agent of `presets.rs`); `open_app`;
  input (`touch`, `wheel`, `insert_text`, `key`, `back`); `text_layer` (`__dragonflyTextLayer` of the `dragonfly`
  package, in debug); `typing`, `screenshot`, `start_frames` (a PNG screencast), `reload` (the terminal device:
  `flutter run --machine`, `app.restart`), `close` (`Browser.close` + `kill_tree`).
- **`cdp.rs`**: a minimal Chrome DevTools Protocol client. One thread owns the WebSocket (tungstenite is not
  split): `call` waits for the answer, events go to a channel; `http_get` reads by Content-Length, because Chrome
  keeps the connection open.
- **`presets.rs`**: the devices a device can be, the sizes of the browsers' device toolbar in CSS pixels, portrait:
  `pixel7` (the default), `iphone14pro`, `iphonese`, `iphone15promax`, `galaxys20`, `galaxya51`, `ipadmini`,
  `ipadair`, `ipadpro`, `tabs7`, `responsive`, `laptop`, `desktop`; each with its density, its system (iOS,
  Android, web) and its identity (user agent and `navigator.platform`; none for web). Found by id or name, ignoring
  case, spaces and dashes.
- **`system.rs`**: what depends on the operating system. `device_tmp` (Linux: Flutter's `TMPDIR` is
  `~/.cache/dfly/<n>`, about 500 MB kept off a `/tmp` that is often in RAM; the path is short because the socket of
  the browser's profile allows at most 108 bytes); the browser per system (`CHROME_EXECUTABLE`, the PATH, flatpak,
  `/Applications`, `Program Files`); free ports; `Slot` (the numbers, in `temp/dragonfly-devices/<n>` with the pid;
  a dead one is reused); `alive`, `kill_tree`.
- **`window.rs`**: the browser in app mode (no tabs, no address bar). It waits 1.2 s for the browser's bars
  (`--enable-automation`), measures the page and the window WITHOUT emulation, computes `fit_scale` (the device's
  ratio, at most 85 % of the screen's height), places the window (over CDP; on Hyprland 0.55+ with
  `hl.dsp.window.*` by the class with the mark, else the classic dispatchers; on Sway by `[app_id=...]`; on i3 by
  `--class`), corrects once, then emulates and opens the app. The screen's size comes from Hyprland or Sway
  (`wm_screen`: Chrome does not know it on Wayland). `offset`: device 2 goes to the right, device 3 to the left. On
  a tiling window manager the window floats instead of filling a tile.
- **`terminal/`**: the app runs in a browser without a window. `caps.rs`: what the terminal can draw and its
  colors, from environment variables (no queries: they would mix with the input), and the cell size. `render.rs`
  (pure, tested): `fit`, blocks (two pixels per cell with `▀`) with the app's texts written as letters on top,
  the palettes (truecolor, 256, 16), the cell `diff`, kitty, sixel. `mod.rs`: the start with its progress, the
  loop, the status bar, `?` help, `l` log, keys and mouse, raw mode restored also on a panic.

Screenshots of the terminal device go to the project's `build/screenshots/`.

## What ran

Tested on Linux with Hyprland: two windows at once, a real kitty, blocks with text in a pty (pyte), touch → detail
→ back → rotate; closing the window, `q` or SIGHUP leaves no process. Windows and macOS: only
`cargo check --target`. What did not run is in the [roadmap](../01-product/roadmap.md).

Unit tests: `arguments` (`mod.rs`), `presets_are_found_by_id_or_name`, `slots_take_the_lowest_free_number`,
`this_process_is_alive`, `machine_lines_become_events`, `the_window_keeps_the_aspect_and_fits_the_screen`,
`visible_width_ignores_escape_codes`, and in `render.rs` `the_area_keeps_the_device_aspect`,
`blocks_use_two_pixels_per_cell_and_texts_replace_them`, `unreadable_text_colors_become_black_or_white`,
`color_palettes`, `diff_writes_only_what_changed`, `sixel_and_kitty_envelopes`.

## The editors' devices

The VS Code extension has its own device panel for a mobile app (a Flutter custom device `dragonfly` over a
headless Chromium, the same presets) and a web device for a web project; they are the extension's code, described
with [the extensions](../../../extensions/AGENTS.md).
