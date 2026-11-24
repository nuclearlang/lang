//! The seal of an installation (ADR-platform-0016): what the installer put in `bin/`, `dialects/`, `platforms/`
//! and `generators/` is written to `.seal` (each file's size, time and SHA-256), and those files are made
//! read-only. Every load of a dialect from the installation compares sizes and times (a few milliseconds);
//! `nuclear doctor` compares the hashes too. A changed installation does not build (N0226).

use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// The file the installer writes at the root of an installation.
pub const SEAL_FILE: &str = ".seal";
/// The folders of an installation that only the installer writes. `kinds/` (packages the user adds), `packages/`
/// (the runtimes a package manager builds in place), `tools/` (the definitions generators, which fetch their own
/// packages on first use) and `ai/` are not sealed.
pub const SEALED: [&str; 4] = ["bin", "dialects", "platforms", "generators"];

struct Entry {
    path: String,
    size: u64,
    time: u128,
}

fn files(root: &Path) -> Vec<PathBuf> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            let p = e.path();
            match e.file_type() {
                Ok(t) if t.is_dir() => walk(&p, out),
                Ok(_) => out.push(p),
                Err(_) => {}
            }
        }
    }
    let mut out = Vec::new();
    for d in SEALED {
        walk(&root.join(d), &mut out);
    }
    out.sort();
    out
}

fn entry(root: &Path, p: &Path) -> Option<Entry> {
    // a link is sealed by where it points (symlink_metadata would let its target change unseen)
    let m = std::fs::metadata(p).ok()?;
    let time = m.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_nanos();
    let path = p.strip_prefix(root).ok()?.to_string_lossy().replace('\\', "/");
    Some(Entry { path, size: m.len(), time })
}

fn sha(p: &Path) -> String {
    let bytes = std::fs::read(p).unwrap_or_default();
    Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect()
}

fn set_readonly(p: &Path, readonly: bool) {
    if let Ok(m) = std::fs::metadata(p) {
        let mut perm = m.permissions();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = perm.mode();
            perm.set_mode(if readonly { mode & !0o222 } else { mode | 0o200 });
        }
        #[cfg(not(unix))]
        perm.set_readonly(readonly);
        let _ = std::fs::set_permissions(p, perm);
    }
}

fn dirs(root: &Path) -> Vec<PathBuf> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        out.push(dir.to_path_buf());
        for e in std::fs::read_dir(dir).into_iter().flatten().flatten() {
            if e.file_type().is_ok_and(|t| t.is_dir()) {
                walk(&e.path(), out);
            }
        }
    }
    let mut out = Vec::new();
    for d in SEALED.iter().map(|d| root.join(d)).filter(|d| d.is_dir()) {
        walk(&d, &mut out);
    }
    out
}

/// Makes the sealed folders of `root` writable again: what an installer runs before it replaces them.
pub fn unseal(root: &Path) {
    for d in dirs(root) {
        set_readonly(&d, false);
    }
    for f in files(root) {
        set_readonly(&f, false);
    }
    set_readonly(&root.join(SEAL_FILE), false);
}

/// Seals the installation at `root`: writes `.seal` and makes the sealed folders read-only. Returns how many files.
pub fn seal(root: &Path) -> Result<usize, String> {
    unseal(root);
    let mut text = String::from("# sha256\tsize\ttime\tpath: written by the installer; never edited (ADR-platform-0016)\n");
    let all = files(root);
    for p in &all {
        let e = entry(root, p).ok_or_else(|| format!("cannot read {}", p.display()))?;
        text.push_str(&format!("{}\t{}\t{}\t{}\n", sha(p), e.size, e.time, e.path));
    }
    let seal = root.join(SEAL_FILE);
    std::fs::write(&seal, text).map_err(|e| format!("cannot write {}: {e}", seal.display()))?;
    for f in &all {
        set_readonly(f, true);
    }
    // the folders last, deepest first, so nothing is added or removed in them
    let mut ds = dirs(root);
    ds.reverse();
    for d in ds {
        set_readonly(&d, true);
    }
    set_readonly(&seal, true);
    Ok(all.len())
}

/// What differs between the installation at `root` and its seal: files changed, added or removed (at most 10
/// named). `full` also compares each file's SHA-256. `Err` when the installation has no seal.
pub fn verify(root: &Path, full: bool) -> Result<Vec<String>, String> {
    let text = std::fs::read_to_string(root.join(SEAL_FILE)).map_err(|_| "the installation has no seal".to_string())?;
    let mut sealed = std::collections::BTreeMap::new();
    for line in text.lines().filter(|l| !l.starts_with('#') && !l.is_empty()) {
        let mut f = line.splitn(4, '\t');
        let (Some(h), Some(size), Some(time), Some(path)) = (f.next(), f.next(), f.next(), f.next()) else {
            return Err("the seal is not valid".into());
        };
        sealed.insert(path.to_string(), (h.to_string(), size.parse::<u64>().unwrap_or(0), time.parse::<u128>().unwrap_or(0)));
    }
    let mut problems = Vec::new();
    for p in files(root) {
        let Some(e) = entry(root, &p) else { continue };
        match sealed.remove(&e.path) {
            None => problems.push(format!("added: {}", e.path)),
            Some((h, size, time)) => {
                if size != e.size || time != e.time || (full && h != sha(&p)) {
                    problems.push(format!("changed: {}", e.path));
                }
            }
        }
    }
    problems.extend(sealed.into_keys().map(|p| format!("removed: {p}")));
    let n = problems.len();
    if n > 10 {
        problems.truncate(10);
        problems.push(format!("and {} more", n - 10));
    }
    Ok(problems)
}

/// The installation's quick check, once per process: `None` when it is sealed and unchanged (or there is no
/// installation), otherwise what is wrong.
pub fn problem() -> Option<String> {
    static ONCE: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
    ONCE.get_or_init(|| {
        let root = crate::install_dir()?;
        match verify(&root, false) {
            Ok(p) if p.is_empty() => None,
            Ok(p) => Some(format!("the installation at {} was modified ({})", root.display(), p.join(", "))),
            Err(e) => Some(format!("{e} ({}): run the installer again", root.display())),
        }
    })
    .clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sealed_installation_finds_every_change() {
        let root = std::env::temp_dir().join(format!("nuclear-seal-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("dialects/python")).unwrap();
        std::fs::create_dir_all(root.join("kinds")).unwrap();
        std::fs::write(root.join("dialects/python/dialect.toml"), "name = \"python\"\n").unwrap();
        assert_eq!(verify(&root, false), Err("the installation has no seal".into()));
        assert_eq!(seal(&root), Ok(1));
        assert_eq!(verify(&root, true), Ok(vec![]));
        // read-only: an edit fails
        assert!(std::fs::write(root.join("dialects/python/dialect.toml"), "x").is_err());
        // kinds/ is not sealed
        std::fs::write(root.join("kinds/mine.toml"), "x").unwrap();
        assert_eq!(verify(&root, true), Ok(vec![]));
        // an edit after making it writable is found, and so is a new file
        unseal(&root);
        std::fs::write(root.join("dialects/python/dialect.toml"), "name = \"python2\"\n").unwrap();
        std::fs::write(root.join("dialects/python/extra.toml"), "").unwrap();
        let p = verify(&root, false).unwrap();
        assert_eq!(p, vec!["changed: dialects/python/dialect.toml", "added: dialects/python/extra.toml"]);
        unseal(&root);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
