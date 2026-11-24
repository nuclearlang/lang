//! The machine's registry of Nuclear projects and where each one runs in development: `projects.json` in the user's
//! data folder (`$XDG_DATA_HOME/nuclearlang/`, else `~/.local/share/nuclearlang/`; `%LOCALAPPDATA%\nuclearlang\` on
//! Windows; `NUCLEAR_PROJECTS` names another file). Every build, check, run and `nuclear new` of a platform project
//! records it: its name, folder, platform, dialect, workspace and its development address. The address is the
//! project's own and never moves by itself: the dialect's (`[toolchain] url`), with the `PORT` the project sets
//! (`nuclear env set PORT <port>`, its `.env` files); the registry only records it. `nuclear run` serves there and,
//! when another process holds the port, says which one instead of taking another; a backend in development lets
//! every address of the registry call it (CORS), and a client of a workspace calls the workspace's backend at its
//! address. Only the person's projects are recorded: never a temporary folder nor Nuclear's own projects (its
//! installation, its source tree); a project whose folder is gone, or one of those, leaves the registry on the next
//! read. `nuclear projects` and the MCP tool `projects_list` show it.

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

/// Whether a project at `root` stays out of the registry: a temporary folder (unless the registry is the one
/// `NUCLEAR_PROJECTS` names: a test's), the installation of Nuclear, or a folder of Nuclear's own source tree (its
/// services, examples, checks and the website's onboarding).
fn excluded(root: &Path) -> bool {
    let temp = [std::env::temp_dir(), PathBuf::from("/tmp"), PathBuf::from("/var/tmp")];
    let mine = std::env::var_os(FILE_ENV).is_some_and(|p| !p.is_empty()) || cfg!(test);
    if !mine && temp.iter().any(|t| root.starts_with(t) || t.canonicalize().is_ok_and(|t| root.starts_with(t))) {
        return true;
    }
    let installation = nuclear_dialect::install_dir().into_iter().chain(path().and_then(|p| p.parent().map(Path::to_path_buf)).filter(|_| !mine));
    if installation.into_iter().any(|i| root.starts_with(&i)) {
        return true;
    }
    root.ancestors().any(|a| a.join("nuclear-synapsis-framework").is_dir() && a.join("nuclearlang").join("dialects").is_dir())
}

/// Every project of the registry whose folder still holds its `config.nuc` and that belongs there (`excluded`).
pub fn read() -> Vec<Value> {
    let text = path().and_then(|p| std::fs::read_to_string(p).ok()).unwrap_or_default();
    let all: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    all["projects"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|e| e["root"].as_str().is_some_and(|r| Path::new(r).join(super::packages::CONFIG).is_file() && !excluded(Path::new(r))))
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

/// The project's development address: the dialect's (`default_url`) with the `PORT` the project sets for its
/// environment (its `.env` files: `nuclear env set PORT <port>`), as `(scheme, host, port)`. Never another one.
pub fn address(root: &Path, d: &Dialect) -> Option<(String, String, u16)> {
    let (scheme, host, port) = parts(default_url(d)?)?;
    let environment = crate::env::chosen(root, crate::env::DEFAULT);
    let port = crate::env::file_value(root, &environment, "PORT").and_then(|p| p.trim().parse().ok()).unwrap_or(port);
    Some((scheme.to_string(), host.to_string(), port))
}

/// The registry's entry of the project at `root` (not written).
pub fn entry(root: &Path, m: &Manifest, d: &Dialect) -> Option<Value> {
    let platform = m.platform.as_deref()?;
    let root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let ws = workspace::find(&root).and_then(|w| workspace::load(&w).ok());
    let mut entry = json!({
        "name": m.name,
        "root": root.display().to_string(),
        "platform": platform,
        "dialect": m.dialect,
        "workspace": ws.map(|w| json!({ "name": w.name, "root": w.root.display().to_string() })),
    });
    if let Some((scheme, host, port)) = address(&root, d) {
        entry["url"] = json!(format!("{scheme}://{host}:{port}"));
        entry["scheme"] = json!(scheme);
        entry["host"] = json!(host);
        entry["port"] = json!(port);
    }
    Some(entry)
}

/// `entry` put in `list` in place of the one of its folder.
fn put(list: &mut Vec<Value>, entry: Value) {
    list.retain(|e| e["root"] != entry["root"]);
    list.push(entry);
    list.sort_by(|a, b| a["root"].as_str().cmp(&b["root"].as_str()));
}

/// Records the project at `root` (a build, a check, a run, `nuclear new`) unless it stays out (`excluded`), and
/// returns its entry. A registry that cannot be written never stops the command: it says why.
pub fn record(root: &Path, m: &Manifest, d: &Dialect) -> Option<Value> {
    let entry = entry(root, m, d)?;
    if excluded(Path::new(entry["root"].as_str().unwrap_or_default())) {
        return Some(entry);
    }
    let mut list = read();
    if list.contains(&entry) {
        return Some(entry);
    }
    put(&mut list, entry.clone());
    if let Err(e) = write(&list) {
        eprintln!("warning: {e}");
    }
    Some(entry)
}

/// The entry of the project at `root` read from its own files (its `config.nuc`, its dialect, its `.env`).
pub fn here(root: &Path) -> Option<Value> {
    let m = Manifest::read(root).ok()?;
    let d = super::loader().load(&m.dialect).0?;
    entry(root, &m, &d)
}

/// Which registered project is at `port`, if any (a busy port's likely holder).
pub fn at_port(port: u16) -> Option<Value> {
    read().into_iter().find(|e| e["port"].as_u64() == Some(u64::from(port)))
}

/// The address of the backend of the workspace that holds `root` (its first backend app), read from the backend's
/// own files: the same address `nuclear run` serves it on.
pub fn workspace_backend(root: &Path) -> Option<String> {
    let ws = workspace::load(&workspace::find(root)?).ok()?;
    ws.apps.iter().filter(|a| a.platform == "backend").find_map(|a| here(&ws.root.join(&a.folder))?["url"].as_str().map(str::to_string))
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

    fn project(root: &str, port: u64) -> Value {
        json!({ "name": root, "root": root, "platform": "backend", "dialect": "fastapi", "workspace": null, "port": port })
    }

    #[test]
    fn a_port_is_recorded_as_the_project_gives_it_never_moved() {
        let mut list = Vec::new();
        put(&mut list, project("/a", 8000));
        // another project on the same port keeps it: the registry records, it never reassigns
        put(&mut list, project("/b", 8000));
        put(&mut list, project("/a", 8010));
        let ports: Vec<_> = list.iter().map(|e| (e["root"].as_str().unwrap(), e["port"].as_u64().unwrap())).collect();
        assert_eq!(ports, [("/a", 8010), ("/b", 8000)]);
    }

    #[test]
    fn nuclear_s_own_folders_stay_out() {
        let tree = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..").canonicalize().unwrap();
        assert!(excluded(&tree.join("nuclear-chat/nuclear_chat")));
        assert!(excluded(&tree.join("website/onboarding")));
        assert!(!excluded(Path::new("/home/someone/projects/shop_api")));
        assert_eq!(parts("http://127.0.0.1:8000"), Some(("http", "127.0.0.1", 8000)));
    }
}
