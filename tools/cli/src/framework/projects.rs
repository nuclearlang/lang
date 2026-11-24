//! The machine's registry of Nuclear projects and where each one runs in development: `projects.json` in the user's
//! data folder (`$XDG_DATA_HOME/nuclearlang/`, else `~/.local/share/nuclearlang/`; `%LOCALAPPDATA%\nuclearlang\` on
//! Windows; `NUCLEAR_PROJECTS` names another file). Every build, check, run and `nuclear new` of a platform project
//! records it: its name, folder, platform, dialect, workspace and its development address. Its port is chosen once
//! (the dialect's when no other project has it, else the next one no project has) and kept: `nuclear run` serves on
//! it, a backend in development lets every address of the registry call it (CORS), and a client of a workspace
//! calls the workspace's backend there. A project whose folder is gone leaves the registry. `nuclear projects` and
//! the MCP tool `projects_list` show it.

use super::{landing, workspace};
use nuclear_dialect::Dialect;
use nuclear_transpile::project::Manifest;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

/// The variable that names another registry file (tests, a second registry).
pub const FILE_ENV: &str = "NUCLEAR_PROJECTS";

/// Where the registry is.
pub fn path() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os(FILE_ENV).filter(|p| !p.is_empty()) {
        return Some(p.into());
    }
    // the crate's own tests never touch the user's registry
    if cfg!(test) {
        return Some(std::env::temp_dir().join(format!("nuclear-projects-test-{}.json", std::process::id())));
    }
    let data = if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .filter(|d| !d.is_empty())
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local").join("share")))
    };
    data.map(|d| d.join("nuclearlang").join("projects.json"))
}

/// Every project of the registry whose folder still holds its `config.nuc`.
pub fn read() -> Vec<Value> {
    let text = path().and_then(|p| std::fs::read_to_string(p).ok()).unwrap_or_default();
    let all: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    all["projects"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|e| e["root"].as_str().is_some_and(|r| Path::new(r).join(super::packages::CONFIG).is_file()))
        .collect()
}

fn write(list: &[Value]) -> Result<(), String> {
    let file = path().ok_or("no home folder for the registry of projects")?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    }
    let text = serde_json::to_string_pretty(&json!({ "projects": list })).unwrap_or_default() + "\n";
    // shortcut: two commands writing at the same moment keep one of their changes; the other is recorded on its next build
    let tmp = file.with_extension(format!("json.{}", std::process::id()));
    std::fs::write(&tmp, text).and_then(|_| std::fs::rename(&tmp, &file)).map_err(|e| format!("cannot write {}: {e}", file.display()))
}

/// `scheme`, `host` and `port` of `http://host:port[/...]`.
fn parts(url: &str) -> Option<(&str, &str, u16)> {
    let (scheme, rest) = url.split_once("://")?;
    let (host, port) = rest.split('/').next()?.rsplit_once(':')?;
    Some((scheme, host, port.parse().ok()?))
}

/// The development address a dialect gives its projects: `[toolchain] url` (a server), else `web_url` (an app that
/// also runs as a web page: Flutter web).
pub fn default_url(d: &Dialect) -> Option<&str> {
    d.tool("url").or(d.tool("web_url"))
}

/// `entry` put in `list` with its port: the one it had when no other project has it, else the first one from the
/// default's that no other project has. Returns the entry as recorded.
fn put(list: &mut Vec<Value>, mut entry: Value, default: &str) -> Value {
    let root = entry["root"].clone();
    let old = list.iter().position(|e| e["root"] == root).map(|i| list.remove(i));
    let taken = |p: u64| list.iter().any(|e| e["port"].as_u64() == Some(p));
    if let Some((scheme, host, port)) = parts(default) {
        let kept = old.as_ref().and_then(|o| o["port"].as_u64()).filter(|p| !taken(*p));
        let port = kept.unwrap_or_else(|| (u64::from(port)..=65535).find(|p| !taken(*p)).unwrap_or(u64::from(port)));
        entry["url"] = json!(format!("{scheme}://{host}:{port}"));
        entry["scheme"] = json!(scheme);
        entry["host"] = json!(host);
        entry["port"] = json!(port);
    }
    list.push(entry.clone());
    list.sort_by(|a, b| a["root"].as_str().cmp(&b["root"].as_str()));
    entry
}

/// Records the project at `root` (a build, a check, a run, `nuclear new`). A registry that cannot be written never
/// stops the command: it says why.
pub fn record(root: &Path, m: &Manifest, d: &Dialect) -> Option<Value> {
    let platform = m.platform.as_deref()?;
    let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let ws = workspace::find(&root).and_then(|w| workspace::load(&w).ok());
    let entry = json!({
        "name": m.name,
        "root": root.display().to_string(),
        "platform": platform,
        "dialect": m.dialect,
        "workspace": ws.map(|w| json!({ "name": w.name, "root": w.root.display().to_string() })),
    });
    let mut list = read();
    let entry = put(&mut list, entry, default_url(d).unwrap_or_default());
    if let Err(e) = write(&list) {
        eprintln!("warning: {e}");
    }
    Some(entry)
}

/// The project at `root` as the registry has it.
pub fn of(root: &Path) -> Option<Value> {
    let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf()).display().to_string();
    read().into_iter().find(|e| e["root"] == json!(root))
}

/// The address of the backend of the workspace that holds `root` (its first backend app the registry knows).
pub fn workspace_backend(root: &Path) -> Option<String> {
    let ws = workspace::load(&workspace::find(root)?).ok()?;
    let list = read();
    ws.apps.iter().filter(|a| a.platform == "backend").find_map(|a| {
        let dir = ws.root.join(&a.folder);
        let dir = dir.canonicalize().unwrap_or(dir).display().to_string();
        list.iter().find(|e| e["root"] == json!(dir))?["url"].as_str().map(str::to_string)
    })
}

/// The origins a backend in development lets call it besides its own `origins`: every address of the registry.
pub fn origins() -> String {
    let mut all: Vec<String> = read().iter().filter_map(|e| e["url"].as_str().map(str::to_string)).collect();
    all.sort();
    all.dedup();
    all.join(",")
}

/// `nuclear projects [--json]`.
pub fn command(rest: &[String]) -> Result<(), String> {
    let list = read();
    // the folders that are gone leave the file too
    let _ = write(&list);
    if rest.iter().any(|a| a == "--json") {
        println!("{}", serde_json::to_string_pretty(&json!({ "file": path().map(|p| p.display().to_string()), "projects": list })).unwrap_or_default());
        return Ok(());
    }
    if list.is_empty() {
        println!("{}", landing::dim("no Nuclear project on this machine yet: nuclear new <name> -p backend|web|mobile"));
        return Ok(());
    }
    let width = list.iter().filter_map(|e| e["name"].as_str()).map(str::len).max().unwrap_or(0);
    for e in &list {
        let ws = e["workspace"]["name"].as_str().map(|w| format!("  workspace {w}")).unwrap_or_default();
        println!(
            "{}  {:8} {:8} {:24} {}{}",
            landing::name(&format!("{:width$}", e["name"].as_str().unwrap_or("?"))),
            e["platform"].as_str().unwrap_or("?"),
            e["dialect"].as_str().unwrap_or("?"),
            e["url"].as_str().unwrap_or("-"),
            landing::dim(e["root"].as_str().unwrap_or("?")),
            landing::dim(&ws),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(root: &str) -> Value {
        json!({ "name": root, "root": root, "platform": "backend", "dialect": "fastapi", "workspace": null })
    }

    #[test]
    fn each_project_keeps_its_own_port_and_no_two_share_one() {
        let mut list = Vec::new();
        assert_eq!(put(&mut list, project("/a"), "http://127.0.0.1:8000")["url"], "http://127.0.0.1:8000");
        assert_eq!(put(&mut list, project("/b"), "http://127.0.0.1:8000")["port"], 8001);
        // built again: the same port, never a new one
        assert_eq!(put(&mut list, project("/a"), "http://127.0.0.1:8000")["port"], 8000);
        assert_eq!(put(&mut list, project("/b"), "http://127.0.0.1:8000")["port"], 8001);
        // a web app from its own default, with its own host
        let web = put(&mut list, project("/w"), "http://localhost:5173");
        assert_eq!((web["host"].as_str(), web["port"].as_u64()), (Some("localhost"), Some(5173)));
        // a port two entries share (a file edited by hand): the second one moves
        list.push(json!({ "root": "/c", "port": 8000 }));
        assert_eq!(put(&mut list, project("/c"), "http://127.0.0.1:8000")["port"], 8002);
        assert_eq!(list.len(), 4);
    }

    #[test]
    fn a_dialect_without_an_address_records_none() {
        let mut list = Vec::new();
        assert!(put(&mut list, project("/m"), "")["port"].is_null());
    }
}
