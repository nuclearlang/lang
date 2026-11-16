---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../../../../vscode/docs/01-product/roadmap.md]
---
# Roadmap of the devices in the editor

The CLI's devices (`nuclear device`, a real phone, macOS and Windows) are the pending work of
[`device-emulators/`](../../../../../device-emulators/AGENTS.md).

## Untested

Never tried in a running VS Code:

- Hot reload of each device, the 30-minute idle auto-stop, two devices with two signed-in users, park / unpark when
  switching to a project that is not mobile and back.
- 0.36.1–0.36.3: the device keeping its own group across a workspace round-trip, the monitor-aware sharp streaming.
- The web device panel (only its engine ran).

## To decide with the user

- **The sharpness of the device.** Open with the user: run the device once more after 0.36.3 and say whether it is
  sharp. If it is still soft, the next suspect is the webview's `devicePixelRatio` or VS Code's zoom, not the
  capture.

## Pending

- `reap` has no Windows version, and the watchdog's search of orphan processes (`pgrep`) does not run on Windows.
