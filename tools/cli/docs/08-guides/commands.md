---
status: accepted
owner: Julian Molina
updated: 2026-11-23
related: [tools/cli/src/main.rs, tools/cli/src/framework/mod.rs, tools/cli/docs/08-guides/README.md]
---
# Every command of `nuclear`

The usage text of the command, verbatim (`nuclear help`, `nuclear gen` and `nuclear make` print it). What the
commands are for, and a quick start: [the guide](README.md).

## The compiler's commands

These take a file or a folder, and work outside a project of the framework too.

```text
usage:
  nuclear help [<topic>|<command>]                            this help, a documentation topic or the usage of a command
  nuclear update [--reinstall]                                install the latest release now (the installer, run again; nothing when it
                                                              is already here, --reinstall: all the same). Automatic: a newer release
                                                              (looked for once a day, on a use) installs itself when you stop working
                                                              (30 min without a use) or within 12 hours; --check [--json] says what
                                                              is known, --auto on|off, NUCLEAR_AUTO_UPDATE=0 or CI: never
  nuclear help <word>|words|layout --dialect <name>           a kind, decorator or header word of the dialect (words: all; layout: where each kind's file goes)
  nuclear build <file.nuc> --dialect <name|path> [-o <out>]   transpile (prints to stdout without -o)
  nuclear build <folder> [-o <out>]                           transpile a project (folder with nuclear.toml)
  nuclear check <folder> [--json]                             report the errors of every file of a project
  nuclear check <file.nuc> [--dialect <name|path>] [--json]   report errors (JSON for agents and the LSP)
  nuclear fix <folder|file.nuc> [--dialect|--platform]        apply every exact fix of the errors (the editor's quick
                                                              fixes), then report what is left
  --platform backend|mobile|web                               instead of --dialect: the platform's default dialect
                                                              (the Nuclear of a platform is the same in all of them)
  nuclear fmt <file.nuc|folder>... [--check]                  rewrite the files in the canonical layout (spacing,
                                                              indentation, blank lines; never reorders); --check
                                                              only lists the files that would change (exit 1)
  nuclear tokens <file.nuc>                                   print the tokens produced by the lexer
  nuclear ast <file.nuc>                                      print the syntax tree
  nuclear dialect list                                        list the dialects found
  nuclear dialect check <name|path> [--json]                  validate a dialect's files
  nuclear kind new <name> -p <platform> -d <dialect>          a kind package skeleton in kinds/<name>/ (ADR-synapsis-0004)
  nuclear spec [--dialect <name>|--platform <p>] [--brief]    print the base language and dialect format (for agents);
                                                              with --dialect, also the spec of the dialect and its parents;
                                                              --brief: the short sheet (what changes from TS/Dart)
  nuclear agent init [--dialect <name>]                       AGENTS.md, CLAUDE.md, a Cursor rule and a Claude Code hook for AI agents
  nuclear agent hook                                          (the hook: checks the .nuc an agent edited; reads the tool call on stdin)
  nuclear contracts list                                      the contracts the project (current folder) declares and their state
  nuclear contracts update [<name>...]                        fetch each contract (a url: GET <url>/.nuclear/contract.json; a path:
                                                              its .nuclear/contract.json) and regenerate contracts/<name>/*.nuc
  nuclear defs list [--dialect <name>]                        list the type definitions packages (all, or the dialect's)
  nuclear defs show <Name|Name.member> --dialect <name> [--json] [--inherited]
                                                              print a declaration of the type definitions
  nuclear defs search <text> --dialect <name>                 find declarations whose name contains <text>

options:
  --dialect-path <dir>   extra directory with dialects (repeatable; also $NUCLEAR_DIALECT_PATH, ':'-separated)
  --defs-path <dir>      extra type definitions repository (repeatable; also $NUCLEAR_DEFS_PATH); the defs/
                         folder next to each dialects/ folder is always searched
```

## The framework's commands

These work inside a project made with `nuclear new` (the folder with `config.nuc` or `main.nuc`, here or above).
`nuclear help <command>` of any of them prints this list.

```text
usage: nuclear <command> [arguments]          (names in any case: user_profile, UserProfile)

project
  new <name> [-p mobile] [-d flutter]   (n)  new project of a platform (mobile: flutter; backend: fastapi, nestjs; web: react):
      [--org com.example]                    only .nuc files (+ the Flutter app in build/app for mobile)
  code                                       open the project in VS Code (Flutter run, debug, devices, hot reload)
  watch                                      transpile every time a .nuc changes (VS Code starts it by itself)
  build [apk|appbundle|ios|ipa|web|macos|linux|windows] [-- <flutter build args>]
                                             transpile, pub get and build_runner (and flutter build <target>)
  run [-- <flutter run args>]                build and run on a device (flutter run, -d <device>)
  build --monitor, run --monitor             each Nuclear function and method measured: .nuclear/monitor/report.json
                                             (a web or mobile app posts it to the editor's collector, NUCLEAR_MONITOR_URL,
                                             or to one run --monitor starts)
  device [<device>] [--landscape] [-- <args>] (dv) a test device in its own window, like an emulator (pixel7,
                                             iphone14pro, ipadair...; several at once: device 1, 2, 3)
  device list                                the running devices and the devices it can be
  terminal-device [<device>] [--render kitty|sixel|text|blocks]
                                        (td) the Synapsis Terminal device: the app inside this terminal
  test [--integration] [-- <args>]           build and run test/, or integration_test/ on a device
  analyze                                    build and run flutter analyze on the generated app
  check [--json]                             errors and architecture rules of every .nuc (no Flutter needed)

backend (fastapi, nestjs; the dialect's [toolchain] runs in build/)
  build                                      transpile (nuclear build .)
  install                                    the runtime and the app's packages (a venv, npm install)
  run [-- <args>]                            the server (uvicorn, npm run dev)
  test [-- <args>]                           the tests written in Nuclear (pytest, node:test)
  migrate make <message>                     one migration of the database: the entities minus the last one
                                             (--rename <table>=<new table>, --rename <table>.<column>=<new column>,
                                             any number, the database's names: a rename that keeps the rows, where
                                             make would write a drop and an add)
  migrate [up] | migrate down                applies the pending migrations, or reverts the last one
                                             (--to <migration>: up to that one, or back to it; --fake: only
                                             the history changes; --transaction all|each|none, default all)
  migrate status                             every migration: applied or pending
  add <folder>                               install a kind package (kinds/<name>/, ADR-synapsis-0004) for every project
  agent init                                 AGENTS.md, CLAUDE.md, a Cursor rule and a check hook for AI agents
  clean                                      flutter clean in the app
  repair                                     when the build or the app fails: build, then pub get + build_runner
                                             from scratch, then flutter clean + everything again, until
                                             flutter analyze finds no errors (exit 2: the .nuc have errors)
  explain [--json]                           a run-time error or a test's output (stdin) at its .nuc lines, explained
  monitor [--json]                           what the app is doing: its last run (state, requests, errors with their
                                             stack, output) and, measured, its hot spots (slow, async calls in a
                                             loop, connections, memory) and each function's time
  monitor --on | --off                       measure the project from its next build (build, watch, run) or stop

workspace (spec 022: a folder whose .workspace/workspace.nuc names the business project and its apps;
nuclear help workspace)
  workspace new <path> [--name <n>] [--description <d>]
                                             the folder and its marker
  workspace add <app> --platform mobile|web|backend [--dialect <d>]
                                             nuclear new of the app in the workspace's folder, written in the marker
                                             (nuclear new anywhere inside a workspace does the same)
  workspace remove <app> [--delete]          out of the marker; --delete also deletes its folder
  workspace rename <app> <new> [--project-name] | rename --workspace-name <n>
                                             the app's folder and its entry (--project-name: also its app(name))
  workspace edit [--name <n>] [--description <d>]
  workspace list | show | find               its apps; the workspace and its apps; the workspace of this folder
      [--workspace <dir>] [--json]           default: the workspace that holds the current folder; --json: show's
                                             object {root, name, description, apps: [{name, folder, platform,
                                             dialect, exists}]} (find: or null), {error} when it fails
  check (in a workspace's folder)            checks every app in turn (--json: run it in one app)

projects of this machine (the registry ~/.local/share/nuclearlang/projects.json: every project of yours made,
built or run; never a temporary folder nor Nuclear's own projects)
  projects [--json]                          each project, its platform, dialect, workspace and development address;
                                             its port never moves by itself: the dialect's, or the PORT the project
                                             sets (nuclear env set PORT <port>); run serves there and, when another
                                             process holds it, says which one; a backend in development lets every
                                             address of the registry and any localhost / 127.0.0.1 / [::1] port call
                                             it (CORS), an app of a workspace calls the workspace's backend there
                                             (API_URL)

environments (spec 021: every env("NAME", "default") of the code; values in .env, .env.<env>, .env.local,
.env.<env>.local, the system's keyring, the process: the later wins)
  env list [--env <name>] [--json]           every variable (the code's and the files') × every environment
  env set <NAME> [<value>] [--env <name>] [--local] [--secret]
                                             a value in .env (--env: .env.<name>; --local: the .local file);
                                             --secret: the system's keyring (without a value: read from stdin)
  env unset <NAME> [--env <name>] [--local] [--secret]
  env envs [--json]                          the environments and the active one
  env use <name>                             the project's active environment (.nuclear/env)
  run|build|test|check --env <name>          the environment of the command (else NUCLEAR_ENV, else the active one,
                                             else development; test: test). run refuses a required variable without
                                             a value; build writes build/.env (backend) or the values of the code
                                             (web, mobile; a secret is refused); check --env reports the missing ones

code generation: nuclear make <what> ...   (alias: nuclear g <alias> ...)
  component <component>                 (c)  facade + an example use case
  screen <component> <screen>           (s)  screen + state manager + state model
      [--manager|-m Name] [--state|-st Name] [--route /path]
  statemanager <component> <screen> <name> (sm) a state manager (Cubit) + its state model, in a screen
  statemodel <component> <screen> <name> (smo) a state model, in a screen
  stateful <name>                       (sf) a stateful widget in shared/widgets
  usecase <component> <name>            (uc) a use case
  repository <component> <name>         (r)  a repository and its model
  model <component> <name>              (mo) a model
  service <component> <name>            (sv) a service
  aggregate <component> <name>          (ag) an aggregate
  config <component>                    (cf) the config of a component
  test <component>                      (t)  test/<component>_test.nuc
  event <name>                          (e)  a global event in shared/events
  widget <name>                         (w)  a shared widget in shared/widgets
  guard <name>                          (gd) an access check (canActivate) in shared/guards
  global <name>                         (gl) a global component (@on an event) + its event
  page <name> [--route /x|--not-found]  (pg) a screen shared by the app in shared/screens
  integration <name>                    (it) an integration test in integration_test/
  backend and web projects: <kind> <component> <Name> [--screen <screen>]   any kind of the platform, at its
      place (`nuclear help layout --platform <p>`), from the platform's skeleton (e.g. `make entity books Book`)

finished code from a resource's data (every platform; ADR-codegen-0001): nuclear gen <what> ...
  inspect                               what the project has (components, declarations by kind), as JSON
  component <component>                 a component and its facade
  resource <component> <Name>           models, repository, a use case per action, the facade's aliases, the
                                        controller (backend) or the screen (mobile, web), the tests
      --from-json <file|url> | --from-spec <spec.md> | --fields "id:int name:string origin:Origin?"
      [--source rest[:<base url>]|db] [--path p] [--actions list,get,search,create,update,delete]
      [--screen <screen>] [--plural Names] [--dry-run]       (nuclear gen alone prints every option)
  usecase <component> <Name>            a use case wired into its component: its alias in the facade and, with
                                        --route, its route in the controller (backend)
      [--calls <Repository>.<method>] [--route "POST orders/{id}/cancel"] [--dry-run]

packages of the target (npm, PyPI, pub.dev: any of them, for the project's dialect; ADR-lang-0008)
  add <package>[@version]... [--module <m>]  install it with the dialect's package manager, write it in config.nuc
                                             (dependencies) and generate its type definitions: its names are then
                                             known to the compiler, the editor and the dialect, which imports them
                                             (backend, web: definitions in the project's defs/; mobile: cached in
                                             ~/.cache/nuclearlang/defs, also `flutter add <package>[:version] [--dev]`)
  remove <package>...                        out of config.nuc, the generated project and its definitions

packages and devices (flutter, inside the app)
  pub get|upgrade|outdated                   (pub add|remove = flutter add|remove)
  devices | emulators | logs | install | screenshot | attach | gen-l10n
  flutter <any flutter command>              run any flutter command inside the app

setup
  doctor [--json]                            what NuclearLang and Synapsis need: CLIs, dialect, package, the toolchains, VS Code;
                                             whether the installation is the one its installer sealed (--seal: the installers' last step)
                                             (--json: the toolchains, for the editor)
  setup [flutter] [--dir ~/develop]          install Flutter step by step (system packages, SDK, PATH)
  setup node | python                        Nuclear's own Node.js (nestjs, react) or Python (fastapi), only for Nuclear
                                             (Python comes with the AI services; NUCLEAR_PYTHON / NUCLEAR_NODE name yours)
  credits | author                           the intro animation, the author and the repository

options
  --project <dir>   project folder (default: the folder with main.nuc, here or above)
  FLUTTER           the flutter binary (default: found by itself: FLUTTER_ROOT, PATH, ~/develop/flutter, fvm, ~/development/flutter..., your shell's PATH)
```

## `nuclear gen`

```text
usage:
  nuclear gen inspect                                   what the project has: components and declarations (JSON)
  nuclear gen component <component>                     a component: its facade and its config
  nuclear gen resource <component> <Name> [options]     models, repository, a use case per action, the facade's
                                                          aliases, the controller (backend) or the screen (mobile,
                                                          web), the tests
options of gen resource:
  --from-json <file|url>     the fields from an example answer of the API (a url also gives --source rest)
  --from-spec <spec.md>      the fields from the spec's Key | Type | Description table
  --fields "id:int name:string origin:Origin?"
  --source rest:<base url> | rest | db     another API (an HTTP repository) or the database (default: db; rest with a url)
  --path <path>              the API's path of the resource (default: the url's last segment, or the name)
  --actions list,get,search,create,update,delete   (default: list,get for rest; every one for db)
  --screen <screen>          mobile and web: a screen that lists the resource
  --plural <Names>           when the English plural is not the right one
  --dry-run                  show the files, write nothing
  nuclear gen usecase <component> <Name> [options]      a use case wired into its component: its alias in the facade
                                                          and, with --route, its route in the controller (backend)
options of gen usecase:
  --calls <Repository>.<method>   write the use case too: it only calls that method, which a repository of the project
                             declares (without it <Name> is a use case the project has: its rules are written by hand)
  --route "<VERB> <prefix>[/<path>]"   backend: the route that calls it ("POST orders/{id}/cancel": the controller of
                             `orders` gets it, created when missing; a {name} of the path is a parameter of the use case)
  --dry-run                  show the files, write nothing
```

## `nuclear make` in a backend or web project

`make` names the kinds of the project's platform; where each file goes: `nuclear help layout --platform <p>`.

```text
usage: nuclear make <kind> <component> <Name> [--screen <screen>]
kinds of the backend platform: agent, aggregate, appcomponent, config, controller, entity, listener, model, repository, service, state, tests, tools, usecase
kinds of the web platform: appcomponent, event, model, repository, service, stateful, stateless, statemodel, tests, usecase
```
