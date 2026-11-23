---
status: accepted
owner: Julian Molina
updated: 2026-11-20
related: [tools/cli/src/main.rs, tools/cli/docs/02-architecture/agent-support.md, nuclearlang/docs/07-reference/dialects.md]
---
# The compiler's commands (`tools/cli/src/main.rs`)

One file of commands over the language crates; a command line `framework::claims` takes is the framework's
([overview.md](overview.md), ADR-cli-0003). The text a user sees is the `USAGE` constant: `nuclear help`
prints it, and `nuclear help <command>` prints its lines of it; for a command of the framework (`help gen`,
`framework::is_command`) it prints the framework's usage.

## Commands

| Command | What it does | Function |
|---|---|---|
| `help [<topic>\|<command>]` | The help (with the atlas), a documentation topic, or the usage lines of a command; a word that is neither says which topics explain it (`atlas::not_a_topic`) | `help`, `help_topic` |
| `help start`, `help atlas [--json]` | The onboarding of an agent with no context; every topic by group | `atlas::TOPICS`, `atlas::atlas` |
| `help <word>\|words\|layout --dialect <d>` | A kind, decorator or header word of the dialect (`docs.toml` of its chain); `words` lists them all; `layout` says where each kind's file goes (only a platform's dialect has one) | `dialect_word` |
| `build <file.nuc> --dialect <name\|path> [-o <out>]` | Transpiles a file (stdout without `-o`) | `file_command` |
| `build <folder> [-o <out>]` | Transpiles a project (a folder with `nuclear.toml` or `config.nuc`); the output of a removed `.nuc` is removed, from the previous line map | `project_command` |
| `check <folder\|file.nuc> [--dialect] [--json]` | The errors of a file or of every file of a project; JSON for agents and the language server: one document on stdout (the dialect's own report is printed only when it stops the command, `load_dialect`) | `file_command`, `project_command`, `report` |
| `fix <folder\|file.nuc>` | Applies every exact fix of the errors (the editor's quick fixes), then reports what is left | `apply_fixes` |
| `fmt <file.nuc\|folder>... [--check]` | The canonical layout (spacing, indentation, blank lines; never reorders); `--check` lists what would change, exit 1 | `fmt_command` |
| `tokens <file.nuc>`, `ast <file.nuc>` | The lexer's tokens, the syntax tree | `file_command` |
| `dialect list`, `dialect check <name\|path> [--json]` | The dialects found; a dialect's files validated, and a warning (N0305) for each plugin of its platform it does not bring yet (`missing_plugins_warning`; a build never prints it) | `dialect_check`, `print_report` |
| `kind new <name> -p <platform> -d <dialect>` | A kind package skeleton in `kinds/<name>/` | `kind_new` |
| `spec [--dialect <d>\|--platform <p>] [--brief]` | The base language and the dialect format for agents; with a dialect, its spec and its parents'; `--brief`: the short sheet; `--platform` alone: the platform's sheet and the topics of the platform and its dialects | `spec`, `brief`, `platform_spec`, `dialect_spec` |
| `agent init [--dialect <d>]`, `agent hook` | A project's files for AI agents; the check hook | [agent-support.md](agent-support.md) |
| `contracts list`, `contracts update [<name>...]` | The contracts the project declares and their state; fetch each (a url: `GET <url>/.nuclear/contract.json`; a path: its `.nuclear/contract.json`) and regenerate `contracts/<name>/*.nuc` | `contracts_list`, `contracts_update`, `current_project` |
| `update` | The latest release: runs the public installer again for this installation (`NUCLEAR_INSTALL`); only an installation a public installer made (its `.version`), a build from source says so and exits 2 | `update::command` |
| `defs list [--dialect]`, `defs show <Name\|Name.member> --dialect <d> [--json] [--inherited]`, `defs search <text> --dialect <d>` | The type definitions packages, a declaration, a search by name | `defs_list`, `defs_show`, `defs_search`, `defs_dialect` |

**The automatic update** (`update::on_use`, before every command; the user, 2026-11-21): a use of NuclearLang marks
the user as working (`~/.cache/nuclearlang/activity`: every command, the editor and the MCP server through
`nuclear update --touch`); at most once a day the latest tag is asked (the redirect of `releases/latest` by `curl`, or
`wget` and the API; at most 3 s, offline the old answer stays for a day, `latest-release`). When it is newer, one
process waits apart (`nuclear update --when-idle`, its own session, `update.lock` with its pid, output in
`update.log`): every minute it looks at the last use and installs once the user stopped (30 minutes without a use) or
12 hours after it was found, working on or not; the public installer runs with `NUCLEAR_UPDATE=1` (the choices of the
last install kept; Windows: in its own window), then `updated` holds the new version (the editor offers a reload).
Never in CI, under `sudo`, for a build from source (no `.version`), with `NUCLEAR_AUTO_UPDATE=0` (or the old
`NUCLEAR_NO_UPDATE_CHECK`), or after `nuclear update --auto off` (`~/.config/nuclearlang/auto-update`, written by the
editor's setting `nuclear.update.auto`); `nuclear update --check [--json]` says `{current, latest, newer, scheduled,
auto}`; `NUCLEAR_UPDATE_DRYRUN=1` prints the installer's line instead of running it (the tests).

Options of every command: `--dialect` / `-d`, `--platform` / `-p` (the platform's default dialect: the Nuclear of a
platform is the same in all of them; `kind new` takes both), `--out` / `-o`, `--json`, `--dialect-path <dir>`,
`--defs-path <dir>`. An unknown option or command prints `USAGE` and exits 2; errors in the code exit 1.

## Where it looks (`loader`)

- Dialects: `--dialect-path` (repeatable), `$NUCLEAR_DIALECT_PATH` (`:`-separated), `./dialects`, then the homes of
  `nuclear_dialect::homes()` (the installation, the working tree).
- Kind packages: `./kinds` and `<install>/kinds`.
- Type definitions: `--defs-path` (repeatable), `$NUCLEAR_DEFS_PATH`, and the `defs/` of each dialect's language.
  `defs show` / `search` also read the packages of the project the command runs in (its `defs/` and
  `build/defs.lock`: the closest folder up that has any).

## The embedded documentation: the atlas (`src/atlas.rs`, spec 016)

What an agent with no context reads to learn Nuclear, on any machine: never a path of the source tree.

- `TOPICS`: each embedded topic with its group and the file it comes from (`topic!`): `start` (the onboarding,
  `agent-files/start.md`), `task-size` (spec 024: do a task or propose Nuclear Builder, `agent-files/task-size.md`), `context-docs` (the code generator's guide), the language's guides and references, each
  language dialect's reference, and the user guides of the tools (`cli`, `commands`, `mcp`, `ai-setup`, `graph`,
  `editors`, `vscode`, `builder`...), each embedded from its own project's `docs/08-guides/`.
- `found()`: found when asked, not embedded: every `docs/07-reference/<name>.md` and `docs/08-guides/<name>.md` of
  the installation and the working tree (the roots of `nuclear_dialect::homes()`) whose name is not embedded; its
  group comes from where it lives (a platform's, a dialect's, the framework's).
- `examples()`: every example of a platform (`platforms/<p>/examples/`, staged by the release): a folder with a
  `config.nuc` or `nuclear.toml`, or one `.nuc` file. `nuclear help example/<name>` prints its `.nuc` files.
- `GROUPS`: the order and meaning of the groups `nuclear help atlas` prints (`--json`: `[{name, group, what}]`).
- `resolve`: every text printed (a topic, `spec`, `spec --brief`, a dialect word) has its relative links resolved: a
  link to a topic becomes `label (`nuclear help <topic>`)`, any other keeps its label; web and anchor links, code
  blocks and inline code stay.
- `mentions` / `not_a_topic`: a word that is not a topic lists the topics that explain it, most mentions first.
- `spec`: the base reference, then (with a dialect) the spec of each dialect of its chain, base first: `spec.md` in
  the dialect's folder, else `docs/07-reference/<name>.md` of its language; then the dialect format and the
  contract generated from the transpiler (`nuclear_dialect::contract::markdown()`), then the available dialects.
- `spec --brief`: the base brief (`nuclearlang/docs/07-reference/brief/nuclear-base.md`), the brief of the dialect's
  platform (`docs/07-reference/brief/<platform>.md` of the platform), then the brief of each dialect of the chain
  (`brief.md` in a dialect's own folder, else the embedded `BRIEFS` of `typescript`, `dart`, `python`, else
  `docs/07-reference/brief/<name>.md`). With `--platform`: only the base and the platform's sheet, what an agent
  that writes only Nuclear reads.
- `spec --platform <p>` (without `--brief`): that sheet and the platform's topics (`platform_spec`), never every
  document joined.

## Tests

- `src/main.rs`: `every_document_is_a_help_topic` (a new guide chapter or reference file of the language must be
  added to `TOPICS`), `no_topic_links_into_the_source_tree` (every topic, brief and platform sheet),
  `links_name_topics_and_keep_web_links`, `the_atlas_groups_every_topic`, `briefs_are_found_and_short` (the whole flutter sheet stays ≤ 16 KB, about 4k tokens; with
  `--platform` nothing of the language underneath comes out), `help_finds_topics_and_commands`.
- `src/agent.rs`: `init_keeps_the_project_files_and_runs_twice`,
  `the_hook_reads_the_type_definitions_of_the_project`.
- `tests/build.rs`: `a_removed_source_takes_its_output_with_it`, `fix_applies_the_exact_fixes`.

`nuclear help` names the targets `.ts / .dart / .py` and ends with the framework's usage, under "projects of the
framework"; the topics `architecture` and `new-dialect` print the language's guides of the same names; a dialect with
no reference prints the heading `# Dialect <name>` and where its reference would be.
