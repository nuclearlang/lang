---
status: accepted
owner: Julian Molina
updated: 2026-11-16
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
| `help [<topic>\|<command>]` | The help, a documentation topic, or the usage lines of a command | `help`, `help_topic` |
| `help <word>\|words\|layout --dialect <d>` | A kind, decorator or header word of the dialect (`docs.toml` of its chain); `words` lists them all; `layout` says where each kind's file goes (only a platform's dialect has one) | `dialect_word` |
| `build <file.nuc> --dialect <name\|path> [-o <out>]` | Transpiles a file (stdout without `-o`) | `file_command` |
| `build <folder> [-o <out>]` | Transpiles a project (a folder with `nuclear.toml` or `config.nuc`); the output of a removed `.nuc` is removed, from the previous line map | `project_command` |
| `check <folder\|file.nuc> [--dialect] [--json]` | The errors of a file or of every file of a project; JSON for agents and the language server: one document on stdout (the dialect's own report is printed only when it stops the command, `load_dialect`) | `file_command`, `project_command`, `report` |
| `fix <folder\|file.nuc>` | Applies every exact fix of the errors (the editor's quick fixes), then reports what is left | `apply_fixes` |
| `fmt <file.nuc\|folder>... [--check]` | The canonical layout (spacing, indentation, blank lines; never reorders); `--check` lists what would change, exit 1 | `fmt_command` |
| `tokens <file.nuc>`, `ast <file.nuc>` | The lexer's tokens, the syntax tree | `file_command` |
| `dialect list`, `dialect check <name\|path> [--json]` | The dialects found; a dialect's files validated | `dialect_check`, `print_report` |
| `kind new <name> -p <platform> -d <dialect>` | A kind package skeleton in `kinds/<name>/` | `kind_new` |
| `spec [--dialect <d>\|--platform <p>] [--brief]` | The base language and the dialect format for agents; with a dialect, its spec and its parents'; `--brief`: the short sheet | `spec`, `brief`, `dialect_spec` |
| `agent init [--dialect <d>]`, `agent hook` | A project's files for AI agents; the check hook | [agent-support.md](agent-support.md) |
| `contracts list`, `contracts update [<name>...]` | The contracts the project declares and their state; fetch each (a url: `GET <url>/.nuclear/contract.json`; a path: its `.nuclear/contract.json`) and regenerate `contracts/<name>/*.nuc` | `contracts_list`, `contracts_update`, `current_project` |
| `defs list [--dialect]`, `defs show <Name\|Name.member> --dialect <d> [--json] [--inherited]`, `defs search <text> --dialect <d>` | The type definitions packages, a declaration, a search by name | `defs_list`, `defs_show`, `defs_search`, `defs_dialect` |

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

## The embedded documentation

- `TOPICS`: (topic, what it is, text), compiled in with `include_str!` from `nuclearlang/docs/08-guides/` (the
  guide's chapters, `reference`, `new-dialect`), `nuclearlang/docs/07-reference/` (`base`, `library`, `grammar`,
  `keywords`, `diagnostics`, `projects`, `dialects`, `defs`, `decisions`) and each language dialect's reference
  (`typescript`, `nodejs`, `dart`, `python`).
- `platform_topics()`: found when asked, not embedded: every `docs/07-reference/<name>.md` and
  `docs/08-guides/<name>.md` of the installation and the working tree (`doc_roots()`: the folders of
  `nuclear_dialect::homes()` that have a `docs/`) whose name is not an embedded topic. This is how the framework's,
  each platform's and each framework dialect's documents are help topics (`nuclear help flutter`).
- `spec`: the base reference, then (with a dialect) the spec of each dialect of its chain, base first: `spec.md` in
  the dialect's folder, else `docs/07-reference/<name>.md` of its language; then the dialect format and the
  contract generated from the transpiler (`nuclear_dialect::contract::markdown()`), then the available dialects.
- `spec --brief`: the base brief (`nuclearlang/docs/07-reference/brief/nuclear-base.md`), the brief of the dialect's
  platform (`docs/07-reference/brief/<platform>.md` of the platform), then the brief of each dialect of the chain
  (`brief.md` in a dialect's own folder, else the embedded `BRIEFS` of `typescript`, `dart`, `python`, else
  `docs/07-reference/brief/<name>.md`). With `--platform`: only the base and the platform's sheet, what an agent
  that writes only Nuclear reads.

## Tests

- `src/main.rs`: `every_document_is_a_help_topic` (a new guide chapter or reference file of the language must be
  added to `TOPICS`), `briefs_are_found_and_short` (the whole flutter sheet stays ≤ 16 KB, about 4k tokens; with
  `--platform` nothing of the language underneath comes out), `help_finds_topics_and_commands`.
- `src/agent.rs`: `init_keeps_the_project_files_and_runs_twice`,
  `the_hook_reads_the_type_definitions_of_the_project`.
- `tests/build.rs`: `a_removed_source_takes_its_output_with_it`, `fix_applies_the_exact_fixes`.

`nuclear help` names the targets `.ts / .dart / .py` and ends with the framework's usage, under "projects of the
framework"; the topics `architecture` and `new-dialect` print the language's guides of the same names; a dialect with
no reference prints the heading `# Dialect <name>` and where its reference would be.
