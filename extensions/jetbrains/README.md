# NuclearLang for Android Studio / IntelliJ

[Website](https://nuclearlang.github.io/tools/android-studio) · [IntelliJ](https://nuclearlang.github.io/tools/intellij)

The NuclearLang plugin for JetBrains IDEs (build 251+): the language server, the grammar and Chernobyl themes, code
metrics, Synapsis mobile projects that work like Flutter projects, and the *HTTP Connections* and *Nuclear Builder*
tool windows.

## Why

- A Flutter developer lives in Android Studio: write the app in Nuclear and keep the device picker, Run / Debug,
  hot reload and DevTools.
- Saving a `.nuc` builds and hot reloads the running app.
- Nuclear Atlas and the Nuclear workspace are VS Code only.

## How we made it

- **The same server and grammar as every editor**, through the IDE's native LSP API
  ([ADR-extensions-0001](../docs/03-adr/0001-one-base-extension-per-editor.md)).
- **The IDE runs what it knows**: the generated app is a module the Flutter plugin runs.
- **The tool windows read the same files as VS Code**; their code is in [`../tools/`](../tools/).
- **Written in Java**, compiled with `javac`, no Gradle. Compiled, never loaded in a running IDE.

## Try it

```sh
cd extensions/jetbrains
IDE_HOME=/opt/android-studio ./build.sh       # → build/nuclearlang-<version>.zip
```

Then *Settings → Plugins → Install Plugin from Disk…* → the zip.

## Read next

- [The guide](docs/08-guides/README.md)
- [Which class does what](docs/02-architecture/overview.md)
- [The extensions](../README.md), [the roadmap](docs/01-product/roadmap.md)
- To change it: [AGENTS.md](AGENTS.md)
