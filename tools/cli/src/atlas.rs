//! The atlas (spec 016): every documentation topic of an installation, by group, for an agent with no context. The
//! language's documents are embedded; the framework's, each platform's and each dialect's are found at run time in
//! the installation. Every text printed has its links resolved: a link to another topic names the topic, any other
//! relative link keeps only its text, so nothing points into a source tree the reader does not have.

use std::path::{Path, PathBuf};

use crate::{GUIDES, REFERENCE};

/// One embedded topic.
pub struct Topic {
    pub name: &'static str,
    pub group: &'static str,
    pub what: &'static str,
    /// The file it was embedded from, relative to the tree's root: its stem resolves links to it.
    pub file: &'static str,
    pub text: &'static str,
}

macro_rules! topic {
    ($name:literal, $group:literal, $what:literal, $file:literal) => {
        Topic { name: $name, group: $group, what: $what, file: $file, text: include_str!(concat!("../../../", $file)) }
    };
}

/// The groups, in the order the atlas prints them, with what each holds.
pub const GROUPS: &[(&str, &str)] = &[
    ("start", "begin here"),
    ("language", "the base language: the guide's chapters and the full rules"),
    ("library", "Nuclear's standard library"),
    ("project", "a project of yours: how it is organized and documents itself"),
    ("framework", "Synapsis, the framework: its generators and kinds"),
    ("platform", "each platform of Synapsis: what is written in it, its first project"),
    ("dialect", "each dialect: the Nuclear → target equivalences"),
    ("tools", "the tools: the command, the MCP server, the AI services, the editors and their tools"),
    ("examples", "validated examples of each platform (built by the CI): nuclear help example/<name>"),
    ("compiler", "how the transpiler and the dialect format work (for dialect authors)"),
];

/// The documentation embedded in the binary. A guide chapter or reference file of the language added to the tree
/// is added here (test `every_document_is_a_help_topic`).
pub const TOPICS: &[Topic] = &[
    topic!("start", "start", "what Nuclear is, the rules never broken, the work cycle, the tools", "tools/cli/agent-files/start.md"),
    topic!("task-size", "start", "the size of a task: do it yourself, or propose Nuclear Builder (small, medium, large)", "tools/cli/agent-files/task-size.md"),
    topic!(
        "context-docs",
        "project",
        "the context documents of a project: AGENTS.md, docs/ in layers, specs, ADRs, the roadmap",
        "tools/code_generator/docs/08-guides/context-docs.md"
    ),
    topic!("guide", "language", "the language guide: index of the chapters", "nuclearlang/docs/08-guides/README.md"),
    topic!("syntax", "language", "guide 1: files, indentation, comments, names", "nuclearlang/docs/08-guides/01-syntax.md"),
    topic!("variables", "language", "guide 2: variables, const or let, scope", "nuclearlang/docs/08-guides/02-variables.md"),
    topic!("types", "language", "guide 3: types, lists, maps, nullable", "nuclearlang/docs/08-guides/03-types.md"),
    topic!("functions", "language", "guide 4: functions, parameters, return, async, alias", "nuclearlang/docs/08-guides/04-functions.md"),
    topic!("lambdas", "language", "guide 5: lambdas", "nuclearlang/docs/08-guides/05-lambdas.md"),
    topic!("modules", "language", "guide 6: modules and constructors", "nuclearlang/docs/08-guides/06-modules.md"),
    topic!("inheritance", "language", "guide 7: inheritance, interfaces, override, super", "nuclearlang/docs/08-guides/07-inheritance.md"),
    topic!("generics", "language", "guide 8: generics", "nuclearlang/docs/08-guides/08-generics.md"),
    topic!("expressions", "language", "guide 9: operators, strings, cascades, destructuring", "nuclearlang/docs/08-guides/09-expressions.md"),
    topic!("control", "language", "guide 10: if, match, for, while (if and match are values)", "nuclearlang/docs/08-guides/10-control.md"),
    topic!("use", "language", "guide 11: use (imports)", "nuclearlang/docs/08-guides/11-use.md"),
    topic!("errors", "language", "guide 12: try, catch, throw", "nuclearlang/docs/08-guides/12-errors.md"),
    topic!("results", "language", "guide 13: Result<E, T>, Ok, Err, automatic propagation", "nuclearlang/docs/08-guides/13-results.md"),
    topic!(
        "operations",
        "language",
        "guide 14: math, bits, text, regex, collections, types, bytes, dates and async in each target",
        "nuclearlang/docs/08-guides/14-operations.md"
    ),
    topic!("reference", "language", "the whole base language in one page, for quick lookup", "nuclearlang/docs/08-guides/reference.md"),
    topic!("base", "language", "spec: every rule of the base language", "nuclearlang/docs/07-reference/nuclear-base.md"),
    topic!("grammar", "language", "spec: the grammar (EBNF)", "nuclearlang/docs/07-reference/grammar.ebnf"),
    topic!("keywords", "language", "spec: reserved words", "nuclearlang/docs/07-reference/reserved-words.md"),
    topic!("diagnostics", "language", "spec: every error code (N0001...)", "nuclearlang/docs/07-reference/diagnostics.md"),
    topic!("projects", "language", "spec: projects of several files", "nuclearlang/docs/07-reference/projects.md"),
    topic!(
        "library",
        "library",
        "spec: the standard library of Nuclear (strings, lists, maps, Math, Json, Regex, DateTime...)",
        "nuclearlang/docs/07-reference/library.md"
    ),
    topic!("typescript", "dialect", "dialect typescript", "nuclearlang/dialects/typescript/docs/07-reference/typescript.md"),
    topic!("nodejs", "dialect", "dialect nodejs", "nuclearlang/dialects/nodejs/docs/07-reference/nodejs.md"),
    topic!("dart", "dialect", "dialect dart", "nuclearlang/dialects/dart/docs/07-reference/dart.md"),
    topic!("python", "dialect", "dialect python (Python 3.12+, typed)", "nuclearlang/dialects/python/docs/07-reference/python.md"),
    topic!("cli", "tools", "the nuclear command: a quick start, the commands by job, how agents use it", "tools/cli/docs/08-guides/README.md"),
    topic!("commands", "tools", "every command and option of nuclear", "tools/cli/docs/08-guides/commands.md"),
    topic!("mcp", "tools", "the MCP server: set-up of each client, how a model works with it, every tool", "tools/mcp/docs/08-guides/mcp.md"),
    topic!("ai-setup", "tools", "the AI services (Smart Graph, Chat; the local models on standby): set-up, profiles, remove", "installer/docs/08-guides/ai-setup.md"),
    topic!("graph", "tools", "the Smart Graph: the knowledge base the agents read", "nuclear-graph-storage/docs/08-guides/README.md"),
    topic!("editors", "tools", "the editor extensions (VS Code, JetBrains, Zed) and their tools", "extensions/docs/08-guides/README.md"),
    topic!("vscode", "tools", "the VS Code extension: what it does and its settings", "extensions/vscode/docs/08-guides/README.md"),
    topic!("workspace", "tools", "a workspace: the folder of a business project and its apps (nuclear workspace)", "tools/cli/docs/08-guides/workspace.md"),
    topic!("editor-workspace", "tools", "the Nuclear workspace panel of VS Code", "extensions/vscode/docs/08-guides/workspace.md"),
    topic!("run-and-debug", "tools", "running and debugging a project from VS Code", "extensions/vscode/docs/08-guides/run-and-debug.md"),
    topic!("devices", "tools", "the devices: an app in a phone's window or in the terminal", "device-emulators/docs/08-guides/README.md"),
    topic!("builder", "tools", "Nuclear Builder: the software factory in the editor", "extensions/tools/nuclear-builder/docs/08-guides/README.md"),
    topic!("builder-spec", "tools", "Nuclear Builder: writing a spec", "extensions/tools/nuclear-builder/docs/08-guides/write-a-spec.md"),
    topic!("builder-run", "tools", "Nuclear Builder: following a run", "extensions/tools/nuclear-builder/docs/08-guides/follow-a-run.md"),
    topic!("builder-commands", "tools", "Nuclear Builder: its commands", "extensions/tools/nuclear-builder/docs/08-guides/pipeline-commands.md"),
    topic!("ask-the-team", "tools", "Nuclear Builder: asking the team", "extensions/tools/nuclear-builder/docs/08-guides/ask-the-team.md"),
    topic!("nuclear-atlas", "tools", "Nuclear Atlas: the knowledge base in the editor", "extensions/tools/nuclear-atlas/docs/08-guides/README.md"),
    topic!("monitor", "tools", "Nuclear Monitor: each function's time, calls, connections and memory", "extensions/tools/nuclear-monitor/docs/08-guides/README.md"),
    topic!("device-manager", "tools", "the device manager of the editor", "extensions/tools/nuclear-device-manager/docs/08-guides/README.md"),
    topic!("http-connections", "tools", "HTTP Connections: the requests of a project in the editor", "extensions/tools/nuclear-http-connections/docs/08-guides/README.md"),
    topic!("chat", "tools", "Nuclear Chat: connecting a host", "nuclear-chat/docs/08-guides/connect-a-host.md"),
    topic!("architecture", "compiler", "how the transpiler works: its stages and the rules of its design", "nuclearlang/docs/08-guides/architecture.md"),
    topic!("new-dialect", "compiler", "guide: creating a dialect with a coding agent", "nuclearlang/docs/08-guides/create-a-dialect-with-an-agent.md"),
    topic!("dialects", "compiler", "spec: the dialect format (TOML + templates)", "nuclearlang/docs/07-reference/dialects.md"),
    topic!("defs", "compiler", "spec: type definitions packages", "nuclearlang/docs/07-reference/definitions.md"),
    topic!("decisions", "compiler", "every design decision and why", "nuclearlang/docs/07-reference/decisions.md"),
];

/// A topic found in the installation (or the working tree): a reference or guide of the framework, a platform or a
/// dialect that is not embedded.
pub struct Found {
    pub name: String,
    pub group: &'static str,
    pub what: String,
    pub path: PathBuf,
}

/// The documents of the framework, its platforms and the dialects, found when asked: every reference `<name>.md`
/// and guide of the installation (and of the working tree) whose name is not already a topic.
pub fn found() -> Vec<Found> {
    let mut out: Vec<Found> = Vec::new();
    for home in nuclear_dialect::homes() {
        for root in home.roots() {
            let group = if root.starts_with(&home.platforms) {
                "platform"
            } else if root.starts_with(&home.dialects) {
                "dialect"
            } else {
                "framework"
            };
            for dir in [REFERENCE, GUIDES] {
                for entry in std::fs::read_dir(root.join(dir)).into_iter().flatten().flatten() {
                    let path = entry.path();
                    let Some(name) = path.file_stem().map(|s| s.to_string_lossy().to_string()) else { continue };
                    if path.extension().is_none_or(|e| e != "md") || name == "README" {
                        continue;
                    }
                    if TOPICS.iter().any(|t| t.name == name) || out.iter().any(|t| t.name == name) {
                        continue;
                    }
                    let text = std::fs::read_to_string(&path).unwrap_or_default();
                    let what = text.lines().find_map(|l| l.strip_prefix("# ")).unwrap_or(&name).replace('`', "");
                    out.push(Found { name, group, what, path });
                }
            }
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

/// A validated example of a platform: a project folder (with a `config.nuc`) or a single `.nuc` file.
pub struct Example {
    pub name: String,
    pub platform: String,
    pub what: String,
    pub path: PathBuf,
}

/// Every example of the installation's platforms (`platforms/<platform>/examples/`), by name.
pub fn examples() -> Vec<Example> {
    let mut out: Vec<Example> = Vec::new();
    for home in nuclear_dialect::homes() {
        for root in home.roots().into_iter().filter(|r| r.starts_with(&home.platforms)) {
            let platform = root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            collect_examples(&root.join("examples"), &platform, &mut out);
        }
    }
    out.sort_by(|a, b| (&a.platform, &a.name).cmp(&(&b.platform, &b.name)));
    out
}

const NOT_EXAMPLES: &[&str] = &["build", "expected", "node_modules", ".dart_tool", ".nuclear"];

fn collect_examples(dir: &Path, platform: &str, out: &mut Vec<Example>) {
    let mut entries: Vec<PathBuf> = std::fs::read_dir(dir).into_iter().flatten().flatten().map(|e| e.path()).collect();
    entries.sort();
    for path in entries {
        let name = path.file_stem().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let (main, is_example) = if path.is_dir() {
            if NOT_EXAMPLES.contains(&name.as_str()) {
                continue;
            }
            if !path.join("config.nuc").is_file() && !path.join("nuclear.toml").is_file() {
                collect_examples(&path, platform, out);
                continue;
            }
            (["main.nuc", "config.nuc"].iter().map(|f| path.join(f)).find(|p| p.is_file()), true)
        } else {
            (Some(path.clone()), path.extension().is_some_and(|e| e == "nuc"))
        };
        if !is_example || out.iter().any(|e| e.name == name) {
            continue;
        }
        // a project says what it is in its config.nuc (`description = "..."`); a file in its first comment
        let described = std::fs::read_to_string(path.join("config.nuc")).ok().and_then(|t| {
            let at = t.find("description = \"")? + "description = \"".len();
            t[at..].split('"').next().map(str::to_string)
        });
        let first = described.or_else(|| {
            main.and_then(|m| std::fs::read_to_string(m).ok()).and_then(|t| {
                t.lines().find_map(|l| l.trim().strip_prefix("//").map(|c| c.trim().to_string())).filter(|c| !c.is_empty())
            })
        });
        let what = first.unwrap_or_else(|| if path.is_dir() { "a project".into() } else { "one file".into() });
        out.push(Example { name, platform: platform.to_string(), what, path });
    }
}

/// An example's `.nuc` files, each under its path, in code blocks.
fn example_text(e: &Example) -> String {
    let mut files: Vec<PathBuf> = Vec::new();
    nuc_files(&e.path, &mut files);
    files.sort();
    let mut out = format!("# Example {} ({} platform)\n\n{}\n", e.name, e.platform, e.what);
    let base = if e.path.is_dir() { e.path.as_path() } else { e.path.parent().unwrap_or(&e.path) };
    for f in files {
        let rel = f.strip_prefix(base).unwrap_or(&f).display().to_string();
        let code = std::fs::read_to_string(&f).unwrap_or_default();
        out.push_str(&format!("\n## {rel}\n\n```nuclear\n{}\n```\n", code.trim_end()));
    }
    out
}

fn nuc_files(path: &Path, out: &mut Vec<PathBuf>) {
    if path.is_file() {
        out.push(path.to_path_buf());
        return;
    }
    for entry in std::fs::read_dir(path).into_iter().flatten().flatten() {
        let p = entry.path();
        let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if p.is_dir() && !NOT_EXAMPLES.contains(&name.as_str()) {
            nuc_files(&p, out);
        } else if p.extension().is_some_and(|e| e == "nuc") {
            out.push(p);
        }
    }
}

/// A topic's text, its links resolved; `None` when no topic has that name.
pub fn text(name: &str) -> Option<String> {
    if let Some(example) = name.strip_prefix("example/") {
        return examples().iter().find(|e| e.name == example).map(example_text);
    }
    let found = found();
    let raw = match TOPICS.iter().find(|t| t.name == name) {
        Some(t) => t.text.to_string(),
        None => std::fs::read_to_string(&found.iter().find(|t| t.name == name)?.path).ok()?,
    };
    Some(resolve(&raw, &found))
}

/// The topic a linked file is: an embedded one by its file's stem, a found one by its name.
fn topic_of(target: &str, found: &[Found]) -> Option<String> {
    let file = target.split('#').next()?;
    let stem = Path::new(file).file_stem()?.to_str()?;
    if stem == "README" {
        return None;
    }
    TOPICS
        .iter()
        .find(|t| Path::new(t.file).file_stem().and_then(|s| s.to_str()) == Some(stem))
        .map(|t| t.name.to_string())
        .or_else(|| found.iter().find(|t| t.name == stem).map(|t| t.name.clone()))
}

/// The text with every relative markdown link resolved (code blocks and inline code untouched): a link to a topic
/// becomes `label (`nuclear help <topic>`)`, any other keeps its label alone. Web and anchor links stay.
pub fn resolve(text: &str, found: &[Found]) -> String {
    // the prose between code blocks is resolved as a whole: a link's label may wrap to the next line
    let mut out = String::with_capacity(text.len());
    let mut fenced = false;
    let mut prose = String::new();
    for line in text.split_inclusive('\n') {
        let fence = line.trim_start().starts_with("```");
        if fenced || fence {
            out.push_str(&resolve_prose(&std::mem::take(&mut prose), found));
            out.push_str(line);
            if fence {
                fenced = !fenced;
            }
        } else {
            prose.push_str(line);
        }
    }
    out.push_str(&resolve_prose(&prose, found));
    out
}

fn resolve_prose(line: &str, found: &[Found]) -> String {
    if !line.contains("](") {
        return line.to_string();
    }
    let mut out = String::with_capacity(line.len());
    let mut rest = line;
    let mut code = false;
    while let Some(c) = rest.chars().next() {
        if c == '`' {
            code = !code;
        } else if c == '\n' && rest[1..].trim_start_matches([' ', '\t']).starts_with('\n') {
            // inline code spans lines inside a paragraph, never past it
            code = false;
        } else if c == '[' && !code {
            // `[label](target)`, the label without a nested bracket
            if let Some(close) = rest.find("](")
                && !rest[1..close].contains('[')
                && !rest[1..close].contains("\n\n")
                && let Some(end) = rest[close + 2..].find(')')
            {
                let label = &rest[1..close];
                let target = &rest[close + 2..close + 2 + end];
                let keep = target.contains("://") || target.starts_with('#') || target.starts_with("mailto:");
                if keep {
                    out.push_str(&rest[..close + 3 + end]);
                } else {
                    // an image's `!` stays before the label: harmless text
                    out.push_str(label);
                    if let Some(topic) = topic_of(target, found)
                        && !label.contains(&format!("nuclear help {topic}"))
                    {
                        out.push_str(&format!(" (`nuclear help {topic}`)"));
                    }
                }
                rest = &rest[close + 3 + end..];
                continue;
            }
        }
        out.push(c);
        rest = &rest[c.len_utf8()..];
    }
    out
}

/// Every topic as `(name, group, what)`, embedded first.
pub fn all() -> Vec<(String, &'static str, String)> {
    TOPICS
        .iter()
        .map(|t| (t.name.to_string(), t.group, t.what.to_string()))
        .chain(found().into_iter().map(|t| (t.name, t.group, t.what)))
        .chain(examples().into_iter().map(|e| (format!("example/{}", e.name), "examples", format!("{}: {}", e.platform, e.what))))
        .collect()
}

/// `nuclear help atlas`: every topic by group, one line each.
pub fn atlas() -> String {
    let topics = all();
    let mut out = String::from("The atlas: every topic, by group. Read one: nuclear help <topic> (MCP: nuclear_doc).\n");
    for (group, what) in GROUPS {
        out.push_str(&format!("\n{group}: {what}\n"));
        for (name, _, line) in topics.iter().filter(|(_, g, _)| g == group) {
            out.push_str(&format!("  {name:<20} {line}\n"));
        }
    }
    out
}

/// `nuclear help atlas --json`: `[{name, group, what}]`.
pub fn atlas_json() -> String {
    let items: Vec<serde_json::Value> =
        all().into_iter().map(|(name, group, what)| serde_json::json!({ "name": name, "group": group, "what": what })).collect();
    serde_json::to_string_pretty(&items).unwrap_or_default()
}

/// The topics of one platform: its documents and those of its dialects (`dialects`: the platform's dialect names).
pub fn platform_lines(platform: &str, dialects: &[String]) -> String {
    let mut out = String::new();
    for t in found() {
        let of_platform = t.group == "platform" && t.path.components().any(|c| c.as_os_str() == platform);
        if of_platform || dialects.contains(&t.name) {
            out.push_str(&format!("  {:<20} {}\n", t.name, t.what));
        }
    }
    out
}

/// The topics that mention a word that is not a topic, the most mentions first (at most five): what an agent reads
/// instead of guessing.
pub fn mentions(word: &str) -> Vec<String> {
    let word = word.trim_start_matches('@').to_lowercase();
    if word.len() < 3 {
        return Vec::new();
    }
    let mut counts: Vec<(usize, String)> = all()
        .into_iter()
        .filter_map(|(name, _, _)| {
            let text = text(&name)?.to_lowercase();
            let n = text
                .match_indices(&word)
                .filter(|(i, _)| {
                    let before = text[..*i].chars().next_back().is_none_or(|c| !c.is_alphanumeric() && c != '_');
                    let after = text[i + word.len()..].chars().next().is_none_or(|c| !c.is_alphanumeric() && c != '_');
                    before && after
                })
                .count();
            (n > 0).then_some((n, name))
        })
        .collect();
    counts.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    counts.into_iter().take(5).map(|(_, n)| n).collect()
}

/// The line printed for a word that is neither a topic nor a command.
pub fn not_a_topic(word: &str) -> String {
    match mentions(word).as_slice() {
        [] => format!("'{word}' is not a topic nor a command; every topic: nuclear help atlas"),
        found => format!(
            "'{word}' is not a topic nor a command; it is explained in: {} (nuclear help <topic>; every topic: nuclear help atlas)",
            found.join(", ")
        ),
    }
}
