//! The toolchains of the backend and web platforms (ADR-cli-0004): Python (fastapi) and Node.js (nestjs, react).
//! Python comes with the installation: the AI services' own (`<installation>/ai/python`), used without asking. Node.js
//! does not: the user's own, or Nuclear's when the user says yes (`nuclear setup node`, into the installation's
//! `toolchains/`: a relocatable build, no administrator rights, nothing else on the machine changes); a system without
//! the AI archive (an Intel Mac, Windows on arm) gets Python the same way (`nuclear setup python`).
//! Found in this order: the variable (`NUCLEAR_PYTHON`, `NUCLEAR_NODE`: the executable, what the editor's settings
//! pass), the installation's (included, then `toolchains/`), the PATH. A dialect names the one it needs with
//! `[toolchain] needs`.

use std::io::IsTerminal;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct Tool {
    /// `python`, `node`: the word of `nuclear setup <name>` and of `[toolchain] needs`, and the folder in `toolchains/`
    pub name: &'static str,
    /// the variable that names the executable
    pub env: &'static str,
    /// the executable, in the PATH and in Nuclear's own (`bin/<exe>`)
    pub exe: &'static str,
    /// what it is, for people
    pub what: &'static str,
}

pub const PYTHON: Tool = Tool { name: "python", env: "NUCLEAR_PYTHON", exe: "python3", what: "Python (backend: fastapi)" };
pub const NODE: Tool =
    Tool { name: "node", env: "NUCLEAR_NODE", exe: "node", what: "Node.js (backend: nestjs; web: react)" };
pub const ALL: [&Tool; 2] = [&PYTHON, &NODE];

pub fn of(name: &str) -> Option<&'static Tool> {
    ALL.into_iter().find(|t| t.name == name)
}

/// Where a toolchain was found.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Source {
    Env,
    /// the AI services' Python, part of the installation
    Included,
    /// installed by `nuclear setup <name>`
    Nuclear,
    Path,
}

/// The folder of Nuclear's own copy: `<installation>/toolchains/<name>`.
pub fn own_dir(t: &Tool) -> Option<PathBuf> {
    nuclear_dialect::install_dir().map(|d| d.join("toolchains").join(t.name))
}

/// The toolchain that comes with the installation: the AI services' Python (`ai/python`).
fn included(t: &Tool) -> Option<PathBuf> {
    let python = nuclear_dialect::install_dir()?.join("ai").join("python");
    (t.name == "python").then(|| if cfg!(windows) { python.join("python.exe") } else { python.join("bin").join("python3") })
}

/// The executable of a toolchain and where it was found.
pub fn find(t: &Tool) -> Option<(PathBuf, Source)> {
    if let Some(p) = std::env::var_os(t.env).map(PathBuf::from).filter(|p| p.is_file()) {
        return Some((p, Source::Env));
    }
    if let Some(p) = included(t).filter(|p| p.is_file()) {
        return Some((p, Source::Included));
    }
    if let Some(p) = own_dir(t).map(|d| d.join("bin").join(t.exe)).filter(|p| p.is_file()) {
        return Some((p, Source::Nuclear));
    }
    let names: &[&str] = if cfg!(windows) { &["python.exe", "node.exe"] } else { &[t.exe] };
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .flat_map(|d| names.iter().map(move |n| d.join(n)))
        .find(|p| p.is_file() && p.file_stem().is_some_and(|s| t.exe.starts_with(&*s.to_string_lossy())))
        .map(|p| (p, Source::Path))
}

/// What a missing toolchain's user does.
pub fn missing(t: &Tool) -> String {
    format!(
        "{} is not installed. Install Nuclear's own (no administrator rights): nuclear setup {}\n\
         or install it yourself and put it in the PATH, or name its executable: export {}=/path/to/{}",
        t.what, t.name, t.env, t.exe
    )
}

/// Before a toolchain command of a dialect (`[toolchain] needs`): its toolchain found and put first in the PATH of
/// the commands this process runs; when it is missing, offered (a terminal) or explained.
pub fn ready(needs: Option<&str>) -> Result<(), String> {
    let Some(t) = needs.and_then(of) else { return Ok(()) };
    let found = match find(t) {
        Some(f) => f,
        None if std::io::stdin().is_terminal() => {
            println!("{}", missing(t));
            if !super::setup::ask(&format!("Install Nuclear's own {} now?", t.name)) {
                return Err(format!("{} is needed: nuclear setup {}", t.what, t.name));
            }
            install(t)?;
            find(t).ok_or_else(|| missing(t))?
        }
        None => return Err(missing(t)),
    };
    version(&found.0).map_err(|e| format!("{} ({}) does not run: {e}\nnuclear doctor says what to do", t.what, found.0.display()))?;
    let dir = found.0.parent().map(Path::to_path_buf).unwrap_or_default();
    let mut dirs = vec![dir];
    dirs.extend(std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect::<Vec<_>>()).unwrap_or_default());
    let path = std::env::join_paths(dirs).map_err(|e| e.to_string())?;
    // SAFETY: the command line tool runs one thread here, before it starts the toolchain's commands
    unsafe { std::env::set_var("PATH", path) };
    Ok(())
}

/// `nuclear setup python|node`: Nuclear's own copy in `<installation>/toolchains/<name>`, checked against its sha256.
pub fn install(t: &Tool) -> Result<(), String> {
    let os = std::env::consts::OS;
    if os != "linux" && os != "macos" {
        return Err(format!(
            "nuclear setup {} works on Linux and macOS; on Windows install {} yourself and name it: set {}=C:\\path\\to\\{}.exe",
            t.name, t.what, t.env, t.exe
        ));
    }
    let dir = own_dir(t).ok_or("no installation folder: install NuclearLang with its installer first")?;
    if !dir.join("bin").join(t.exe).is_file() {
        download_into(t, &dir)?;
    }
    let exe = dir.join("bin").join(t.exe);
    let mut run = version(&exe);
    // Node.js's Linux builds load libatomic, which a minimal distribution lacks
    if let Err(e) = &run
        && e.contains("libatomic")
        && super::setup::libatomic()?
    {
        run = version(&exe);
    }
    let v = run.map_err(|e| format!("{} is in {} but does not run: {e}", t.what, dir.display()))?;
    println!("{} {v} is installed: {}", super::landing::ok("✓"), exe.display());
    Ok(())
}

/// The latest build of a toolchain, checked against its sha256 and unpacked as `dir`.
fn download_into(t: &Tool, dir: &Path) -> Result<(), String> {
    let parent = dir.parent().ok_or("no toolchains folder")?.to_path_buf();
    std::fs::create_dir_all(&parent).map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
    let (url, sha256, top) = match t.name {
        "python" => python_download()?,
        _ => node_download()?,
    };
    let file = parent.join(url.rsplit('/').next().unwrap_or("download.tar.gz"));
    println!("Nuclear's own {} goes into {} (only Nuclear uses it; nothing else changes).", t.what, dir.display());
    println!("From {url}");
    super::setup::shell("curl", &["-fL", "--progress-bar", "-o", &file.to_string_lossy(), &url])?;
    if sha256_of(&file)? != sha256 {
        let _ = std::fs::remove_file(&file);
        return Err(format!("the download is damaged (its sha256 does not match): run nuclear setup {} again", t.name));
    }
    let _ = std::fs::remove_dir_all(parent.join(&top));
    super::setup::shell("tar", &["-xzf", &file.to_string_lossy(), "-C", &parent.to_string_lossy()])?;
    let _ = std::fs::remove_file(&file);
    if top != t.name {
        std::fs::rename(parent.join(&top), dir).map_err(|e| format!("cannot move {top} to {}: {e}", dir.display()))?;
    }
    Ok(())
}

/// What `<exe> --version` prints, or why it does not run.
pub fn version(exe: &Path) -> Result<String, String> {
    let out = Command::new(exe).arg("--version").output().map_err(|e| format!("cannot run {}: {e}", exe.display()))?;
    let text = |b: &[u8]| String::from_utf8_lossy(b).trim().to_string();
    if out.status.success() {
        Ok(text(if out.stdout.is_empty() { &out.stderr } else { &out.stdout }))
    } else {
        Err(text(&out.stderr))
    }
}

fn fetch(url: &str) -> Result<Vec<u8>, String> {
    let out = Command::new("curl").args(["-fsSL", url]).output().map_err(|e| format!("cannot run curl ({e}): install curl"))?;
    if out.status.success() { Ok(out.stdout) } else { Err(format!("cannot download {url}: check the internet connection")) }
}

fn sha256_of(file: &Path) -> Result<String, String> {
    let out = match std::env::consts::OS {
        "macos" => Command::new("shasum").args(["-a", "256"]).arg(file).output(),
        _ => Command::new("sha256sum").arg(file).output(),
    }
    .map_err(|e| format!("cannot check the download: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).split_whitespace().next().unwrap_or("").to_string())
}

/// The Python of the AI services' own (python-build-standalone, relocatable): the newest 3.13 of the latest release.
/// (url, sha256, the folder the archive unpacks to)
fn python_download() -> Result<(String, String, String), String> {
    let triple = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        (os, arch) => return Err(format!("there is no Python build of Nuclear's for {os} {arch}: install Python yourself")),
    };
    let api = "https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest";
    let release: serde_json::Value =
        serde_json::from_slice(&fetch(api)?).map_err(|_| "cannot read the Python builds' release".to_string())?;
    let asset = python_asset(&release, triple).ok_or(format!("the latest Python builds have no 3.13 for {triple}"))?;
    Ok((asset.0, asset.1, "python".into()))
}

/// The `cpython-3.13.*-<triple>-install_only_stripped.tar.gz` asset of a release: its url and sha256 (`digest`).
fn python_asset(release: &serde_json::Value, triple: &str) -> Option<(String, String)> {
    let suffix = format!("-{triple}-install_only_stripped.tar.gz");
    release["assets"].as_array()?.iter().find_map(|a| {
        let name = a["name"].as_str()?;
        (name.starts_with("cpython-3.13.") && name.ends_with(&suffix)).then_some(())?;
        let sha = a["digest"].as_str()?.strip_prefix("sha256:")?;
        Some((a["browser_download_url"].as_str()?.to_string(), sha.to_string()))
    })
}

/// The latest LTS Node.js from nodejs.org's index, its sha256 from the release's SHASUMS256.txt.
fn node_download() -> Result<(String, String, String), String> {
    let os = if std::env::consts::OS == "macos" { "darwin" } else { "linux" };
    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        a => return Err(format!("there is no Node.js build for {a}: install Node.js yourself")),
    };
    let index: serde_json::Value = serde_json::from_slice(&fetch("https://nodejs.org/dist/index.json")?)
        .map_err(|_| "cannot read Node.js's release index".to_string())?;
    let version = node_lts(&index).ok_or("Node.js's index has no LTS release")?;
    let top = format!("node-{version}-{os}-{arch}");
    let file = format!("{top}.tar.gz");
    let sums = String::from_utf8_lossy(&fetch(&format!("https://nodejs.org/dist/{version}/SHASUMS256.txt"))?).to_string();
    let sha = sums
        .lines()
        .find_map(|l| l.split_once("  ").filter(|(_, f)| *f == file).map(|(s, _)| s.to_string()))
        .ok_or(format!("Node.js {version} has no {file}"))?;
    Ok((format!("https://nodejs.org/dist/{version}/{file}"), sha, top))
}

/// The newest release marked LTS (`"lts": "Krypton"`; `false` for the others); the index is newest first.
fn node_lts(index: &serde_json::Value) -> Option<String> {
    index.as_array()?.iter().find(|r| r["lts"].is_string()).and_then(|r| r["version"].as_str()).map(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_python_asset_is_the_313_install_only_of_the_system() {
        let release = serde_json::json!({"assets": [
            {"name": "cpython-3.14.1+20261101-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz",
             "browser_download_url": "u314", "digest": "sha256:a"},
            {"name": "cpython-3.13.9+20261101-x86_64-unknown-linux-gnu-install_only.tar.gz",
             "browser_download_url": "full", "digest": "sha256:b"},
            {"name": "cpython-3.13.9+20261101-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz",
             "browser_download_url": "u313", "digest": "sha256:c"},
        ]});
        assert_eq!(python_asset(&release, "x86_64-unknown-linux-gnu"), Some(("u313".into(), "c".into())));
        assert_eq!(python_asset(&release, "aarch64-apple-darwin"), None);
    }

    #[test]
    fn the_node_release_is_the_newest_lts() {
        let index = serde_json::json!([
            {"version": "v27.1.0", "lts": false},
            {"version": "v26.13.1", "lts": "Lumen"},
            {"version": "v24.9.0", "lts": "Krypton"},
        ]);
        assert_eq!(node_lts(&index).as_deref(), Some("v26.13.1"));
    }

    #[test]
    fn a_toolchain_is_known_by_its_name() {
        assert_eq!(of("python").map(|t| t.env), Some("NUCLEAR_PYTHON"));
        assert_eq!(of("node").map(|t| t.env), Some("NUCLEAR_NODE"));
        assert!(of("flutter").is_none());
    }
}
