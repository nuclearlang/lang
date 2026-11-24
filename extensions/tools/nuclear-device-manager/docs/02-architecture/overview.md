---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [mobile-device.md, web-device.md, ../../../../docs/03-adr/0002-the-nuclear-workspace.md, ../../../../vscode/docs/02-architecture/workspace.md]
---
# Architecture of the devices

Two kinds of device, both a headless Chromium the editor drives over CDP (`cdp.ts`, shared):

| Device | For | Files | Document |
|---|---|---|---|
| Synapsis device | a mobile project | `mobile-device.ts` | [mobile-device.md](mobile-device.md) |
| Web device | a web project, one panel per project | `web-device.ts`, `web-session.ts` | [web-device.md](web-device.md) |

The rest of this file is about the Synapsis devices: there can be several at once.

## Panels and running apps

- `panels` is a `Set<DevicePanel>`; each has its own `running`, `lastView` and `id`.
- `Running` (an app) lives on its own: `panel` is optional, with `title`, `lastUsed`, `ended`. `alive()` = the
  panels' apps + `parked`.
- `DevicePanel.show(context, preset?)` always opens one more panel (title `Synapsis device N`; a `preset` message
  selects the device). `freeNumber()` gives the lowest free number, so a closed device frees its name.
- The launch configuration carries `synapsisPanel`, the panel to run on, and its `name` is the device's title (the
  debug toolbar and the Debug Console pick by device). `nuclear.runOnDevice(panelId?, root?, noDebug)`: without a
  panel it takes `DevicePanel.idle()`, a free panel, or a new one. A running device is never replaced.
- `watchSessions` finds the panel of a session by `running.key`.
- `devices()` / `devicesChanged` / `revealDevice` feed the workspace's Devices pane.

## Hiding, parking, ending

| What happens | Effect |
|---|---|
| The user closes a device's tab | the disposed panel parks its app: it goes on, hidden; the Devices pane lists it (`hidden:<key>` ids) and `revealDevice` adopts it again |
| The workspace switches tab (`Workspace.switchTabs`) | `nuclear.parkDevices` → `DevicePanel.park()`, before the code closes: the panels close, the apps go on with their sessions (`parked`), and their emptied groups are closed too (a locked group stays standing when it empties; left alone it became the only group and the next device spanned the editor) |
| A mobile workspace or the Devices tool is entered | `nuclear.unparkDevices` → `unpark()`, after the code is reopened: each device gets a fresh locked editor group to the right of the code (`lockDeviceGroup`), never merged into the code's group. In the Devices tool the code's group is empty and the only one: VS Code would put a device "beside" it into it, so `showTool` makes an empty group to its right first and the device goes there, at its width |
| ✕ of the Devices pane (`nuclear.closeDevice(id)`), the panel's ■, the end of its session | `endRunning`: the session, the CDP connection, the browser and `reap` |
| A parked app's session ends | cleaned by `endRunning` |
| Nobody looked at a device for `IDLE_LIMIT` (30 minutes: hidden, or its panel not visible) | the watchdog ends it |

`watchdog()` runs every `WATCH_MS` (one minute): it ends the idle devices and, with `pgrep -af` by marker, reaps
the keys no app owns.

## Processes

Nothing stays alive when VS Code closes.

- `marker(key)` = `__synapsis_device_<extension host pid>_<key>__`, written in `--web-launch-url`, so every
  process of a device carries it.
- `reap(mark, wait?)` is a detached `sh`: it waits for `wait` to die, then `pkill -TERM -f`, 3 s, `-KILL`. On
  activation one is left waiting for the extension host itself, so a closed or crashed VS Code ends every app the
  window started; a device that ends reaps its own key. There is no Windows version.

## The presets

`PRESETS` are the sizes of the browsers' device toolbar (CSS pixels, portrait): Responsive, iPhone SE, iPhone 14
Pro, iPhone 15 Pro Max, Pixel 7, Samsung Galaxy S20 Ultra, Samsung Galaxy A51/71, iPad Mini, iPad Air, iPad Pro,
Galaxy Tab S7, Laptop, Desktop. Each has its size, its `dpr`, its system (`ios`, `android`, `web`: the user agent
and the platform) and its frame (phone, tablet, none). The CLI's devices use the same.

## In the workspace

- The tool `devices` (`Ctrl+Alt+V`): the open devices with their state, *▷ run* and *+ New device*.
- `Workspace.pickDevice(p, mode)` for ▷ Run / ◉ Debug / ▭ Device: the devices shown or hidden, a new one, *Other
  Flutter device…* (`flutter.selectDevice`), or the Devices workspace. `Workspace.mobileRoot`: the Devices pane runs
  a mobile project only.

## Settings and languages

- The settings of the devices are its own section of the editor's settings, read only through `src/settings.ts`: `nuclear.devices.idleMinutes`, the minutes a device waits unused before it stops (30)
  (spec 011, settings by component).
- Its texts are in English and Spanish in `src/l10n.ts` (a dictionary of `extensions/vscode/src/i18n.ts`), for the Synapsis device (`mobile-device.ts`) and the web device (`web-device.ts`); device names, Hot Reload / Hot Restart and network presets stay as they are.
  The host sends the page the texts of the chosen language (`nuclear.language`); English is the fallback. A change
  of language reaches a device's page when it opens next: re-rendering it would cut its live screen.
