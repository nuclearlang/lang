//! The workspace (spec 022): a folder that organizes one business project and the apps that form it. It is a
//! workspace when it holds the marker `.workspace/workspace.nuc`, Nuclear read by the compiler's parser as
//! `config.nuc` is (`project::read_calls`): one `workspace(name, description)` and an `app(folder, platform)` per
//! app, each app a Synapsis project in that folder. This module is the only reader and writer of the marker;
//! `nuclear workspace ...` and `nuclear new` inside a workspace go through it.

use super::{landing, new_name, new_project_in, packages};
use nuclear_diag::{Diagnostic, SourceFile, Span, codes, render_text};
use nuclear_transpile::project::{self, Manifest};
use serde_json::{Value, json};
use std::path::{Component, Path, PathBuf};

/// Where the marker is, relative to the workspace's folder.
pub const MARKER: &str = ".workspace/workspace.nuc";
const PLATFORMS: &[&str] = &["mobile", "web", "backend"];
const HEADER: &str = "// The workspace: the business project and the apps that form it (nuclear workspace ...).";
const USAGE: &str = "usage: nuclear workspace <command>      (nuclear help workspace)
  new <path> [--name <n>] [--description <d>]
  add <app> --platform mobile|web|backend [--dialect <d>]
  remove <app> [--delete]
  rename <app> <new> [--project-name] | rename --workspace-name <n>
  edit [--name <n>] [--description <d>]
  list | show | find
options: --workspace <dir> (default: the workspace that holds the current folder), --json";

/// One app of the workspace: its folder (its name in the workspace) and its platform.
#[derive(Debug, Clone, PartialEq)]
pub struct App {
    pub folder: String,
    pub platform: String,
    /// The comment lines written right above its `app(...)`: they stay with it.
    lead: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Workspace {
    pub root: PathBuf,
    pub name: String,
    pub description: String,
    /// In the order the marker lists them; a new app goes last.
    pub apps: Vec<App>,
    lead: Vec<String>,
    trailer: Vec<String>,
}

/// The workspace that holds `start` (it or a folder above it), as an absolute path without links.
pub fn find(start: &Path) -> Option<PathBuf> {
    let start = std::path::absolute(start).ok()?;
    let root = start.ancestors().find(|d| d.join(MARKER).is_file())?;
    Some(root.canonicalize().unwrap_or_else(|_| root.to_path_buf()))
}

/// A folder of the marker stays a folder of the workspace: one plain name (no `/`, no `..`, not hidden).
fn folder_safe(folder: &str) -> bool {
    let mut parts = Path::new(folder).components();
    matches!((parts.next(), parts.next()), (Some(Component::Normal(_)), None))
        && !folder.starts_with('.')
        && !folder.contains(['/', '\\'])
}

/// The comment lines of a stretch of the marker between two calls.
fn comments(gap: &str) -> Vec<String> {
    gap.lines().map(str::trim).filter(|l| l.starts_with("//")).map(str::to_string).collect()
}

/// The marker's text read into a workspace; an error is printed as the compiler prints one (N0303).
pub fn parse(root: &Path, text: &str) -> Result<Workspace, String> {
    let file = SourceFile::new(root.join(MARKER).display().to_string(), text.to_string());
    let fail = |span: Span, msg: String| render_text(&[Diagnostic::error(codes::PROJECT, span, msg)], &file);
    let (calls, diags) = project::read_calls(text, &["workspace".to_string(), "app".to_string()]);
    let errors: Vec<Diagnostic> = diags.into_iter().filter(Diagnostic::is_error).collect();
    if !errors.is_empty() {
        return Err(render_text(&errors, &file));
    }
    let mut ws = Workspace {
        root: root.to_path_buf(),
        name: String::new(),
        description: String::new(),
        apps: Vec::new(),
        lead: Vec::new(),
        trailer: Vec::new(),
    };
    let (mut seen, mut previous) = (false, 0);
    for call in &calls {
        let lead = comments(&text[previous..call.span.start]);
        previous = call.span.end;
        let takes: &[&str] = if call.section == "workspace" { &["name", "description"] } else { &["folder", "platform"] };
        if let Some(a) = call.args.iter().find(|a| !takes.contains(&a.name.as_str())) {
            return Err(fail(a.name_span, format!("{}(...) takes only {}", call.section, takes.join(" and "))));
        }
        let get = |k: &str| call.args.iter().find(|a| a.name == k);
        if call.section == "workspace" {
            if seen {
                return Err(fail(call.span, "'workspace' is written twice".into()));
            }
            seen = true;
            ws.name = get("name").map(|a| a.value.clone()).filter(|n| !n.trim().is_empty()).ok_or_else(|| {
                fail(call.span, "workspace(...) needs a name: workspace(name = \"shop\")".into())
            })?;
            ws.description = get("description").map(|a| a.value.clone()).unwrap_or_default();
            ws.lead = lead;
            continue;
        }
        let (Some(folder), Some(platform)) = (get("folder"), get("platform")) else {
            return Err(fail(call.span, "app(...) needs folder and platform: app(folder = \"api\", platform = \"backend\")".into()));
        };
        if !folder_safe(&folder.value) {
            return Err(fail(folder.value_span, format!("'{}' is not a folder of the workspace: one name, without / or ..", folder.value)));
        }
        if !PLATFORMS.contains(&platform.value.as_str()) {
            return Err(fail(platform.value_span, format!("'{}' is not a platform (mobile, web, backend)", platform.value)));
        }
        if ws.apps.iter().any(|a| a.folder == folder.value) {
            return Err(fail(call.span, format!("the app '{}' is written twice", folder.value)));
        }
        ws.apps.push(App { folder: folder.value.clone(), platform: platform.value.clone(), lead });
    }
    if !seen {
        return Err(fail(Span::default(), "missing workspace(name = \"...\"): the workspace's name".into()));
    }
    ws.trailer = comments(&text[previous..]);
    Ok(ws)
}

pub fn load(root: &Path) -> Result<Workspace, String> {
    let path = root.join(MARKER);
    let text = std::fs::read_to_string(&path).map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    parse(root, &text)
}

/// A text of the marker, with the escapes the lexer reads back.
fn quote(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '\\' | '"' | '$' => {
                out.push('\\');
                out.push(c);
            }
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

/// The marker's text: its comments where they were, `workspace(...)` first, then the apps in their order.
pub fn render(ws: &Workspace) -> String {
    let mut out = String::new();
    let mut lines = |lead: &[String], line: String| {
        for l in lead {
            out.push_str(l);
            out.push('\n');
        }
        out.push_str(&line);
        out.push('\n');
    };
    let description =
        if ws.description.is_empty() { String::new() } else { format!(", description = {}", quote(&ws.description)) };
    lines(&ws.lead, format!("workspace(name = {}{description})", quote(&ws.name)));
    for a in &ws.apps {
        lines(&a.lead, format!("app(folder = {}, platform = {})", quote(&a.folder), quote(&a.platform)));
    }
    for l in &ws.trailer {
        out.push_str(l);
        out.push('\n');
    }
    nuclear_syntax::fmt::format(&out).unwrap_or(out)
}

/// Writes the marker whole (a new file renamed over the old one: never half written).
pub fn save(ws: &Workspace) -> Result<(), String> {
    let path = ws.root.join(MARKER);
    let dir = path.parent().unwrap_or(&ws.root);
    std::fs::create_dir_all(dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    let tmp = path.with_extension("nuc.tmp");
    std::fs::write(&tmp, render(ws)).and_then(|_| std::fs::rename(&tmp, &path)).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

/// `nuclear new` inside a workspace: the app written into the marker (again: its platform is the new one).
pub fn register(root: &Path, folder: &str, platform: &str) -> Result<(), String> {
    let mut ws = load(root)?;
    match ws.apps.iter_mut().find(|a| a.folder == folder) {
        Some(a) => a.platform = platform.into(),
        None => ws.apps.push(App { folder: folder.into(), platform: platform.into(), lead: Vec::new() }),
    }
    save(&ws)
}

/// `show --json`: the workspace and each app with its project's name and dialect (from its `config.nuc`).
pub fn to_json(ws: &Workspace) -> Value {
    let apps: Vec<Value> = ws
        .apps
        .iter()
        .map(|a| {
            let dir = ws.root.join(&a.folder);
            let m = Manifest::read_synapsis(&dir).ok();
            json!({
                "name": m.as_ref().map_or(a.folder.clone(), |m| m.name.clone()),
                "folder": a.folder,
                "platform": a.platform,
                "dialect": m.map(|m| m.dialect),
                "exists": dir.is_dir(),
            })
        })
        .collect();
    json!({"root": ws.root.display().to_string(), "name": ws.name, "description": ws.description, "apps": apps})
}

/// `show` for a person: the workspace, then one line per app.
fn to_text(ws: &Workspace, apps_only: bool) -> String {
    let v = to_json(ws);
    let mut out = String::new();
    if !apps_only {
        out.push_str(&format!("{}  {}\n", landing::name(&ws.name), landing::dim(&ws.root.display().to_string())));
        if !ws.description.is_empty() {
            out.push_str(&format!("  {}\n", ws.description));
        }
    }
    let apps = v["apps"].as_array().cloned().unwrap_or_default();
    if apps.is_empty() {
        out.push_str(&landing::dim("  no apps yet: nuclear workspace add <app> --platform mobile|web|backend\n"));
    }
    let width = ws.apps.iter().map(|a| a.folder.len()).max().unwrap_or(0);
    for a in apps {
        let folder = a["folder"].as_str().unwrap_or_default();
        let dialect = a["dialect"].as_str().unwrap_or("-");
        let missing = if a["exists"] == true { "" } else { "  (its folder is missing)" };
        out.push_str(&format!("  {folder:width$}  {:8} {dialect}{missing}\n", a["platform"].as_str().unwrap_or_default()));
    }
    out
}

fn take(args: &mut Vec<String>, name: &str) -> Option<String> {
    let i = args.iter().position(|a| a == name)?;
    args.remove(i);
    (i < args.len()).then(|| args.remove(i))
}

fn flag(args: &mut Vec<String>, name: &str) -> bool {
    let had = args.iter().any(|a| a == name);
    args.retain(|a| a != name);
    had
}

/// A name a person reads: one line, not empty.
fn display_name(n: &str, what: &str) -> Result<String, String> {
    let n = n.trim();
    if n.is_empty() || n.chars().any(char::is_control) {
        return Err(format!("the workspace's {what} is one line of text, not empty"));
    }
    Ok(n.to_string())
}

/// The workspace of `--workspace <dir>` or of the current folder.
fn locate(given: Option<String>, cwd: &Path) -> Result<PathBuf, String> {
    let start = given.map_or_else(|| cwd.to_path_buf(), |d| cwd.join(d));
    find(&start).ok_or_else(|| {
        format!(
            "no workspace holds {} (a folder with {MARKER}; make one: nuclear workspace new <path>)",
            start.display()
        )
    })
}

/// `nuclear workspace ...`. With `--json` it prints `show`'s object (`find`: or `null`), or `{"error": ...}`.
pub fn command(args: Vec<String>) -> Result<(), String> {
    let mut args = args;
    let as_json = flag(&mut args, "--json");
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let apps_only = args.first().is_some_and(|c| c == "list");
    match run(args, &cwd) {
        Ok((ws, done)) => {
            if as_json {
                println!("{}", ws.as_ref().map_or(Value::Null, to_json));
            } else {
                if !done.is_empty() {
                    eprintln!("{} {done}", landing::ok("✓"));
                }
                match &ws {
                    Some(ws) => print!("{}", to_text(ws, apps_only)),
                    None => return Err(format!("no workspace holds {}", cwd.display())),
                }
            }
            Ok(())
        }
        Err(e) if as_json => {
            println!("{}", json!({"error": e}));
            Err(String::new())
        }
        Err(e) => Err(e),
    }
}

/// One command of `nuclear workspace`, from `cwd`: the workspace it leaves (`None`: `find` found none) and what
/// it did, for the person.
pub fn run(mut args: Vec<String>, cwd: &Path) -> Result<(Option<Workspace>, String), String> {
    let given = take(&mut args, "--workspace");
    let Some(cmd) = args.first().cloned() else { return Err(USAGE.into()) };
    let mut words: Vec<String> = args[1..].to_vec();
    let done = match cmd.as_str() {
        "new" => {
            let name = take(&mut words, "--name");
            let description = take(&mut words, "--description").unwrap_or_default();
            let [path] = words.as_slice() else { return Err("usage: nuclear workspace new <path> [--name <n>] [--description <d>]".into()) };
            let dir = std::path::absolute(cwd.join(path)).map_err(|e| e.to_string())?;
            if let Some(outer) = find(&dir) {
                return Err(if dir.join(MARKER).is_file() {
                    format!("{} is a workspace already", dir.display())
                } else {
                    format!("{} is inside the workspace {}: a workspace does not hold another", dir.display(), outer.display())
                });
            }
            if dir.join(packages::CONFIG).is_file() {
                return Err(format!("{} is a project (it has config.nuc): a workspace is the folder that holds its apps", dir.display()));
            }
            let fallback = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let name = display_name(&name.unwrap_or(fallback), "name")?;
            std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
            let root = dir.canonicalize().map_err(|e| e.to_string())?;
            let description = if description.is_empty() { description } else { display_name(&description, "description")? };
            let ws = Workspace { root, name, description, apps: Vec::new(), lead: vec![HEADER.into()], trailer: Vec::new() };
            save(&ws)?;
            let done = format!("workspace {} created in {}", ws.name, ws.root.display());
            return Ok((Some(ws), done));
        }
        "find" => {
            let start = given.map_or_else(|| cwd.to_path_buf(), |d| cwd.join(d));
            return match find(&start) {
                Some(root) => Ok((Some(load(&root)?), String::new())),
                None => Ok((None, String::new())),
            };
        }
        _ => {
            let root = locate(given, cwd)?;
            let ws = load(&root)?;
            change(ws, &cmd, words)?
        }
    };
    let ws = load(&done.0)?;
    Ok((Some(ws), done.1))
}

/// A command on an existing workspace: the root to read again and what it did.
fn change(mut ws: Workspace, cmd: &str, mut words: Vec<String>) -> Result<(PathBuf, String), String> {
    let root = ws.root.clone();
    let index = |ws: &Workspace, app: &str| {
        ws.apps.iter().position(|a| a.folder == app).ok_or_else(|| format!("no app '{app}' in the workspace {} (nuclear workspace list)", ws.name))
    };
    let done = match cmd {
        "list" | "show" if words.is_empty() => String::new(),
        "add" => {
            let platform = take(&mut words, "--platform").or_else(|| take(&mut words, "-p"));
            let dialect = take(&mut words, "--dialect").or_else(|| take(&mut words, "-d"));
            let usage = "usage: nuclear workspace add <app> --platform mobile|web|backend [--dialect <d>]";
            let Some(app) = words.first().cloned() else { return Err(usage.into()) };
            let platform = platform.ok_or(usage)?;
            if !PLATFORMS.contains(&platform.as_str()) {
                return Err(format!("'{platform}' is not a platform (mobile, web, backend)"));
            }
            let folder = new_name(&app)?;
            if ws.apps.iter().any(|a| a.folder == folder) {
                return Err(format!("the workspace {} has an app '{folder}' already", ws.name));
            }
            if root.join(&folder).exists() {
                return Err(format!("{} exists already: choose another name, or remove that folder", root.join(&folder).display()));
            }
            // `nuclear new`'s own words (--org, --websocket, --token) pass on as they are
            let mut rest = vec![folder.clone(), "-p".into(), platform.clone()];
            if let Some(d) = dialect {
                rest.extend(["-d".into(), d]);
            }
            rest.extend(words.into_iter().skip(1));
            new_project_in(rest, Some(&root))?;
            format!("{platform} app {folder} added to the workspace {}", ws.name)
        }
        "remove" => {
            let delete = flag(&mut words, "--delete");
            let [app] = words.as_slice() else { return Err("usage: nuclear workspace remove <app> [--delete]".into()) };
            let i = index(&ws, app)?;
            let dir = root.join(app);
            if delete && dir.exists() {
                let real = dir.canonicalize().map_err(|e| e.to_string())?;
                if !real.starts_with(&root) || real == root {
                    return Err(format!("{} is not inside the workspace: it is not deleted", real.display()));
                }
                std::fs::remove_dir_all(&real).map_err(|e| format!("cannot delete {}: {e}", real.display()))?;
            }
            ws.apps.remove(i);
            save(&ws)?;
            match delete {
                true => format!("app {app} removed from the workspace and its folder deleted"),
                false => format!("app {app} removed from the workspace (its folder is kept: --delete deletes it)"),
            }
        }
        "rename" => {
            if let Some(name) = take(&mut words, "--workspace-name") {
                if !words.is_empty() {
                    return Err("usage: nuclear workspace rename --workspace-name <n>".into());
                }
                ws.name = display_name(&name, "name")?;
                save(&ws)?;
                return Ok((root, format!("the workspace is now {}", ws.name)));
            }
            let project_name = flag(&mut words, "--project-name");
            let [app, new] = words.as_slice() else {
                return Err("usage: nuclear workspace rename <app> <new> [--project-name] | rename --workspace-name <n>".into());
            };
            let i = index(&ws, app)?;
            let new = new_name(new)?;
            let (from, to) = (root.join(app), root.join(&new));
            if new != *app {
                if ws.apps.iter().any(|a| a.folder == new) || to.exists() {
                    return Err(format!("{} exists already: choose another name", to.display()));
                }
                if from.exists() {
                    std::fs::rename(&from, &to).map_err(|e| format!("cannot rename {}: {e}", from.display()))?;
                }
                ws.apps[i].folder = new.clone();
                if let Err(e) = save(&ws) {
                    let _ = std::fs::rename(&to, &from);
                    return Err(e);
                }
            }
            if project_name {
                set_project_name(&to, &new)?;
            }
            format!("app {app} renamed to {new}{}", if project_name { " (and its project's app(name))" } else { "" })
        }
        "edit" => {
            let name = take(&mut words, "--name");
            let description = take(&mut words, "--description");
            if !words.is_empty() || (name.is_none() && description.is_none()) {
                return Err("usage: nuclear workspace edit [--name <n>] [--description <d>]".into());
            }
            if let Some(n) = name {
                ws.name = display_name(&n, "name")?;
            }
            if let Some(d) = description {
                ws.description = if d.is_empty() { d } else { display_name(&d, "description")? };
            }
            save(&ws)?;
            "workspace edited".into()
        }
        _ => return Err(format!("unknown or incomplete workspace command '{cmd}'\n{USAGE}")),
    };
    Ok((root, done))
}

/// `rename --project-name`: the project's `app(name = ...)` in its `config.nuc`, written in place (the rest of the
/// file as it is). Without `app(name)` the project's name is its folder's already.
fn set_project_name(dir: &Path, name: &str) -> Result<(), String> {
    let path = dir.join(packages::CONFIG);
    let Ok(text) = std::fs::read_to_string(&path) else { return Ok(()) };
    let (calls, _) = project::read_calls(&text, &["app".to_string()]);
    let Some(arg) = calls.iter().find(|c| c.section == "app").and_then(|c| c.args.iter().find(|a| a.name == "name")) else {
        return Ok(());
    };
    let text = format!("{}{}{}", &text[..arg.value_span.start], quote(name), &text[arg.value_span.end..]);
    std::fs::write(&path, text).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

/// `nuclear check` in a workspace's folder (not inside one of its apps): each app checked in turn.
pub fn check_all(root: &Path, mut check: impl FnMut(&Path) -> Result<(), String>) -> Result<(), String> {
    let ws = load(root)?;
    let mut failed = Vec::new();
    for a in &ws.apps {
        let dir = root.join(&a.folder);
        if !dir.join(packages::CONFIG).is_file() {
            eprintln!("{} {} {}", landing::dim("──"), a.folder, landing::dim("(no project in its folder: skipped)"));
            continue;
        }
        eprintln!("{} {} {}", landing::dim("──"), landing::name(&a.folder), landing::dim(&a.platform));
        if let Err(e) = check(&dir) {
            if !e.is_empty() {
                eprintln!("{} {e}", landing::bad("✗"));
            }
            failed.push(a.folder.clone());
        }
    }
    match failed.is_empty() {
        true => Ok(()),
        false => Err(format!("errors in {}", failed.join(", "))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("nuclear-workspace-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir.canonicalize().unwrap()
    }

    fn args(line: &str) -> Vec<String> {
        line.split_whitespace().map(str::to_string).collect()
    }

    const MARKER_TEXT: &str = "// The shop and its apps.\nworkspace(name = \"shop\", description = \"Books \\\"and\\\" more\")\n// the API\napp(folder = \"api\", platform = \"backend\")\napp(folder = \"site\", platform = \"web\")\n// the end\n";

    #[test]
    fn the_marker_is_read_and_written_back_with_its_comments() {
        let ws = parse(Path::new("/w"), MARKER_TEXT).unwrap();
        assert_eq!((ws.name.as_str(), ws.description.as_str()), ("shop", "Books \"and\" more"));
        assert_eq!(ws.apps.iter().map(|a| (a.folder.as_str(), a.platform.as_str())).collect::<Vec<_>>(), [("api", "backend"), ("site", "web")]);
        assert_eq!(render(&ws), MARKER_TEXT);
        let mut ws = ws;
        ws.description = "a $ sign\nand a line".into();
        assert_eq!(parse(Path::new("/w"), &render(&ws)).unwrap(), ws);
    }

    #[test]
    fn a_wrong_marker_is_refused_with_its_line() {
        let bad = |text: &str, says: &str| {
            let e = parse(Path::new("/w"), text).unwrap_err();
            assert!(e.contains(says) && e.contains("N0303"), "{e}");
        };
        bad("app(folder = \"api\", platform = \"backend\")\n", "missing workspace");
        bad("workspace(name = \"a\")\napp(folder = \"../x\", platform = \"web\")\n", "not a folder");
        bad("workspace(name = \"a\")\napp(folder = \"a/b\", platform = \"web\")\n", "not a folder");
        bad("workspace(name = \"a\")\napp(folder = \"x\", platform = \"desktop\")\n", "not a platform");
        bad("workspace(name = \"a\")\napp(folder = \"x\", platform = \"web\")\napp(folder = \"x\", platform = \"web\")\n", "twice");
        bad("workspace(name = \"a\")\nworkspace(name = \"b\")\n", "twice");
        bad("workspace(name = \"a\", color = \"red\")\n", "takes only name and description");
        bad("workspace(name = \"a\")\nteam(name = \"x\")\n", "not a section");
        bad("workspace(name = \"a\")\napp(folder = \"x\")\n", "needs folder and platform");
    }

    #[test]
    fn a_workspace_is_found_from_any_folder_inside_it() {
        let dir = temp("find");
        let (ws, _) = run(args("new shop --description Books"), &dir).unwrap();
        let ws = ws.unwrap();
        assert_eq!((ws.name.as_str(), ws.description.as_str(), ws.root.clone()), ("shop", "Books", dir.join("shop")));
        std::fs::create_dir_all(dir.join("shop/api/components")).unwrap();
        assert_eq!(find(&dir.join("shop/api/components")), Some(dir.join("shop")));
        assert_eq!(find(&dir.join("shop/.workspace")), Some(dir.join("shop")));
        assert_eq!(find(&dir), None);
        assert!(run(args("find"), &dir).unwrap().0.is_none());
        assert_eq!(run(args("find"), &dir.join("shop/api")).unwrap().0.unwrap().name, "shop");
        assert!(run(args("new shop"), &dir).unwrap_err().contains("is a workspace already"));
        assert!(run(args("new shop/inner"), &dir).unwrap_err().contains("does not hold another"));
        assert!(run(args("list"), &dir).unwrap_err().contains("no workspace holds"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn edit_rename_and_remove_change_only_the_marker_unless_asked() {
        let dir = temp("edit");
        run(args("new w --name Shop"), &dir).unwrap();
        let w = dir.join("w");
        assert!(run(args("edit"), &w).unwrap_err().starts_with("usage"));
        let (ws, _) = run(vec!["edit".into(), "--description".into(), "An intercom".into()], &w).unwrap();
        assert_eq!(ws.unwrap().description, "An intercom");
        assert_eq!(run(args("rename --workspace-name Citofony"), &w).unwrap().0.unwrap().name, "Citofony");
        // an app written by hand: its folder and its project
        std::fs::create_dir_all(w.join("api")).unwrap();
        std::fs::write(w.join("api/config.nuc"), "synapsis(platform = \"backend\", dialect = \"fastapi\")\napp(name = \"api\", version = \"0.1.0\")\n").unwrap();
        register(&w, "api", "backend").unwrap();
        register(&w, "api", "backend").unwrap();
        let ws = load(&w).unwrap();
        assert_eq!(ws.apps.len(), 1);
        let v = to_json(&ws);
        assert_eq!(v["apps"][0], json!({"name": "api", "folder": "api", "platform": "backend", "dialect": "fastapi", "exists": true}));
        assert!(run(args("rename api ../evil"), &w).unwrap_err().contains("not a project name"));
        assert!(run(args("rename nope x"), &w).unwrap_err().contains("no app 'nope'"));
        run(args("rename api core --project-name"), &w).unwrap();
        assert!(w.join("core/config.nuc").is_file() && !w.join("api").exists());
        assert!(std::fs::read_to_string(w.join("core/config.nuc")).unwrap().contains("app(name = \"core\", version"));
        run(args("rename core api"), &w).unwrap();
        assert!(std::fs::read_to_string(w.join("api/config.nuc")).unwrap().contains("app(name = \"core\""), "the project's name stays");
        run(args("remove api"), &w).unwrap();
        assert!(w.join("api").is_dir() && load(&w).unwrap().apps.is_empty());
        register(&w, "api", "backend").unwrap();
        run(args("remove api --delete"), &w).unwrap();
        assert!(!w.join("api").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn delete_refuses_a_folder_outside_the_workspace() {
        let dir = temp("outside");
        run(args("new w"), &dir).unwrap();
        std::fs::create_dir_all(dir.join("elsewhere")).unwrap();
        std::os::unix::fs::symlink(dir.join("elsewhere"), dir.join("w/link")).unwrap();
        register(&dir.join("w"), "link", "web").unwrap();
        assert!(run(args("remove link --delete"), &dir.join("w")).unwrap_err().contains("not inside the workspace"));
        assert!(dir.join("elsewhere").is_dir());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn add_makes_the_app_with_nuclear_new_and_registers_it() {
        let dir = temp("add");
        run(args("new w"), &dir).unwrap();
        let w = dir.join("w");
        assert!(run(args("add api"), &w).unwrap_err().starts_with("usage"));
        assert!(run(args("add api --platform desktop"), &w).unwrap_err().contains("not a platform"));
        assert!(run(args("add ../api --platform backend"), &w).unwrap_err().contains("not a project name"));
        let (ws, _) = run(args("add shop-api --platform backend"), &w.join(".workspace")).unwrap();
        let v = to_json(&ws.unwrap());
        assert_eq!(v["apps"][0], json!({"name": "shop_api", "folder": "shop_api", "platform": "backend", "dialect": "fastapi", "exists": true}));
        assert!(run(args("add shop_api --platform web"), &w).unwrap_err().contains("already"));
        // `nuclear new` from a folder inside the workspace: the app goes to the workspace's folder and its marker
        new_project_in(args("site -p web -d react"), Some(&w)).unwrap();
        let ws = load(&w).unwrap();
        assert_eq!(ws.apps.iter().map(|a| a.folder.as_str()).collect::<Vec<_>>(), ["shop_api", "site"]);
        assert_eq!(to_json(&ws)["apps"][1]["dialect"], "react");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
