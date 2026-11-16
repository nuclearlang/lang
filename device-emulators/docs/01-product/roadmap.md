---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [device-emulators/docs/02-architecture/overview.md]
---
# Roadmap of the devices

The pending work of `nuclear device` and `nuclear terminal-device`. A done item is deleted. The device panels
of the editors are in [the extensions'](../../../extensions/AGENTS.md) roadmap.

## Untested

- Synapsis devices on macOS and Windows: they compile (`cargo check --target`), they never ran.
- GNOME and KDE: the floating window placed over CDP.
- Real sixel: foot, Konsole, Windows Terminal ≥ 1.22 (an older Windows Terminal: `--render text`).

## Pending

- An engine of our own without a browser (flutter-pi as a guide): not started (ADR-devices-0001 postpones it).
- User feedback of a run: `flutter pub get` was called three times, the device closed with an exception, and it
  used 1.5–2 GB of memory.
