---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../02-architecture/mobile-device.md, ../02-architecture/web-device.md, ../../../../vscode/docs/08-guides/run-and-debug.md, ../../../../../device-emulators/AGENTS.md]
---
# The devices in VS Code

Run your app inside the editor, beside its code. There are two kinds of device:

- the **Synapsis device**, for a mobile project, like Android Studio's *Running Devices*;
- the **web device**, for a web project, at the size of a desktop, a laptop, a tablet or a phone.

Both are a headless Chromium (Chrome, Chromium, Brave, Edge or Vivaldi) that the editor shows and drives. They exist
only in VS Code. In a terminal, or with another editor, use `nuclear device` (its own window) or `nuclear
terminal-device` ([the devices project](../../../../../device-emulators/AGENTS.md)).

## The Synapsis device (mobile)

Flutter runs the app on its `chrome` device, in a headless browser, and the panel shows that browser's screen and
sends it your taps, clicks, wheel and keys. Breakpoints, steps, hot reload and hot restart work as for any Flutter
web app. It needs the Dart and Flutter extensions of VS Code.

**Run an app on a device**

- A mobile project's ▷ Run, ◉ Debug or ▭ Device ([the workspace](../../../../vscode/docs/08-guides/workspace.md))
  asks which device to use: a Synapsis device (shown or hidden), a new one, *Other Flutter device…* (emulators,
  phones, desktop) or the Devices workspace.
- *Synapsis: Run on Synapsis Device* uses a free device, or opens a new one.
- The Synapsis device is also in the Dart extension's device picker. The extension registers it as a Flutter
  custom device and turns on custom devices for VS Code only (it adds `FLUTTER_CUSTOM_DEVICES=true`, and
  `CHROME_EXECUTABLE` when needed, to your `dart.env`). `flutter devices` in a terminal does not list it.

The first run builds Flutter web and takes about a minute; the next ones are incremental.

**The panel's bar**

- The device: Responsive, iPhone SE, iPhone 14 Pro, iPhone 15 Pro Max, Pixel 7, Samsung Galaxy S20 Ultra, Samsung
  Galaxy A51/71, iPad Mini, iPad Air, iPad Pro, Galaxy Tab S7, Laptop, Desktop. Each one sets the size, the pixel
  ratio and the system (iOS, Android or web), so Flutter behaves as it does on that system. Phones and tablets get
  a frame.
- The width × height (editable, and by dragging the borders in Responsive), the zoom (*Fit to window* grows up to
  150 %) and the rotation.
- Hot reload, hot restart, stop (■), and open in your browser.

The panel sits in its own locked editor group to the right of the code. Its width is remembered for each screen
width (the first time it is 20 % of the screen, between 340 and 540 px). The screen is streamed at the pixels the
panel shows, so it stays sharp on a HiDPI monitor.

It is Flutter web, so plugins with native code (camera, files) and `dart:io` do not work there.

## Several devices: the Devices tool

The tool *Devices* of the strip (`Ctrl+Alt+V`) lists the open devices with their state.

- **+ New device** picks a preset and opens one more device beside the others. Each one has its own size, app and
  session, so you can run two signed-in users of a chat side by side. A device takes the lowest free number
  (`Synapsis device 1`, `2`…). The debug sessions carry its name.
- **▷ run** runs the mobile project on that device. A run never replaces an app that is already running.
- **✕** ends a device at once.

What happens to a device:

| You… | The device |
|---|---|
| close its tab | is hidden: the app goes on, and the Devices tool shows it again |
| switch to a project tab that is not mobile, or to another tool | is parked, and comes back when you return to a mobile project or the Devices tool |
| press ✕ in the Devices tool or ■ in the panel, or its session ends | ends now |
| do not look at it for 30 minutes | ends by itself |
| close VS Code, or VS Code crashes | ends, with its `flutter run` and its browser |

A watchdog checks every minute and ends any Flutter or browser process the window no longer owns.

## The web device (web)

A web project's ▭ Device (*Open the web device*) starts the app's dev server (Vite, from `build/app`) and shows the
page in a panel. One panel per project.

- **The address bar**: back, forward, reload (Shift+click reloads without the cache), the address, open the page
  in your browser, and Chrome's DevTools of the page.
- **The device bar**: Responsive, Desktop, Laptop L, Laptop, iPad Pro, iPad Air, iPad Mini, iPhone 15 Pro Max,
  iPhone 14 Pro, iPhone SE, Pixel 7, Galaxy S20 Ultra. Tablets and phones get their user agent and touch.
  Responsive takes any size. Also the rotation, the zoom, the color scheme (light, dark, system), the network
  (fast 4G, slow 3G, offline) and *no cache*.
- **Console** and **Network**: the page's console (errors are counted; a line's source opens the generated file)
  and its requests (method, status, address, type, size, time).
- **Screenshot**: saved into `build/screenshots/`.

◉ Debug of a web project (*Debug on the web device*) attaches VS Code's JavaScript debugger to the device, so a
breakpoint in a `.nuc` stops the page ([run and debug](../../../../vscode/docs/08-guides/run-and-debug.md)).
↻ Reload (*Reload the web device*) reloads it. Saving a `.nuc` rebuilds the project, and Vite reloads the page.

TODO(human): the web device's panel was never opened in a running VS Code (only its engine ran). Check this
section against it once.
