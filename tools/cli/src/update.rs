//! The update of an installation made by the public installers: `nuclear update`, and the question every run in a
//! terminal asks when a newer release is out. The latest version is fetched in the background at most once a day,
//! so no command waits for the network; the update itself is the public installer, run again.

use std::io::{IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::{Duration, SystemTime};

const CURRENT: &str = env!("CARGO_PKG_VERSION");
const LATEST_URL: &str = "https://github.com/nuclearlang/lang/releases/latest";
const DAY: Duration = Duration::from_secs(24 * 60 * 60);

/// The installation this binary runs from, when a public installer made it (its `.version`); a build from source
/// has none and is never updated here.
fn installation(exe: &Path) -> Option<PathBuf> {
    let root = exe.parent()?.parent()?;
    root.join(".version").is_file().then(|| root.to_path_buf())
}

fn cache_file() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_CACHE_HOME")
        .filter(|_| !cfg!(windows))
        .map(PathBuf::from)
        .or_else(|| std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(|h| PathBuf::from(h).join(".cache")))?;
    Some(base.join("nuclearlang").join("latest-release"))
}

/// `1.2.3` (a leading `v` and anything after the third number aside) as numbers to compare.
fn parse(v: &str) -> Option<(u64, u64, u64)> {
    let mut n = v.trim().trim_start_matches('v').split(|c: char| !c.is_ascii_digit()).map(str::parse::<u64>);
    Some((n.next()?.ok()?, n.next()?.ok()?, n.next()?.ok()?))
}

/// The version at the end of the url `releases/latest` redirects to (`…/releases/tag/v0.1.16`).
fn version_of(url: &str) -> Option<&str> {
    let tag = url.trim().rsplit_once("/tag/")?.1;
    parse(tag).map(|_| tag.trim_start_matches('v'))
}

fn newer(latest: &str) -> bool {
    matches!((parse(latest), parse(CURRENT)), (Some(l), Some(c)) if l > c)
}

/// What the last check found, and a new check in the background when it is older than a day.
fn known_latest(cache: &Path) -> Option<String> {
    let age = std::fs::metadata(cache).and_then(|m| m.modified()).ok().and_then(|t| SystemTime::now().duration_since(t).ok());
    let text = std::fs::read_to_string(cache).unwrap_or_default();
    if age.is_none_or(|a| a > DAY) {
        refresh(cache);
    }
    version_of(&text).map(String::from)
}

/// curl writes the redirect's url into the cache, detached: this run does not wait for it.
fn refresh(cache: &Path) {
    let Some(dir) = cache.parent() else { return };
    let Ok(file) = std::fs::create_dir_all(dir).and_then(|_| std::fs::File::create(cache)) else { return };
    let null = if cfg!(windows) { "NUL" } else { "/dev/null" };
    let mut curl = Command::new("curl");
    curl.args(["-fsSLI", "--max-time", "15", "-o", null, "-w", "%{url_effective}", LATEST_URL]);
    // its own process group: the terminal closing right after this command does not stop it
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut curl, 0);
    let _ = curl.stdin(Stdio::null()).stdout(file).stderr(Stdio::null()).spawn();
}

/// Runs the public installer for the installation at `root`. On Windows it opens in a window of its own: the
/// installer replaces `nuclear.exe`, which cannot happen while this process runs.
fn run_installer(root: &Path) -> std::io::Result<bool> {
    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/c", "start", "NuclearLang update", "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]);
        c.arg("irm https://nuclearlang.github.io/install.ps1 | iex");
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", "u=https://nuclearlang.github.io/install.sh; if command -v curl >/dev/null 2>&1; then curl -fsSL \"$u\" | sh; else wget -qO- \"$u\" | sh; fi"]);
        c
    };
    Ok(cmd.env("NUCLEAR_INSTALL", root).status()?.success())
}

/// `nuclear update`: the latest release, now.
pub fn command() -> ExitCode {
    let Some(root) = std::env::current_exe().ok().as_deref().and_then(installation) else {
        eprintln!("this nuclear was not installed by the NuclearLang installer: update it the way it was installed");
        return ExitCode::from(2);
    };
    match run_installer(&root) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(e) => {
            eprintln!("cannot run the installer: {e}");
            ExitCode::FAILURE
        }
    }
}

/// Before a command, in a terminal: when a newer release is known, asks whether to update. On a yes the update runs
/// and the command is run again by the new binary (its exit code returned); otherwise the command goes on (`None`).
/// Never asked without a terminal (editors, agents, pipes, CI) or with `NUCLEAR_NO_UPDATE_CHECK`.
pub fn offer(args: &[String]) -> Option<ExitCode> {
    let terminal = std::io::stdin().is_terminal() && std::io::stdout().is_terminal() && std::io::stderr().is_terminal();
    if !terminal || std::env::var_os("CI").is_some() || std::env::var_os("NUCLEAR_NO_UPDATE_CHECK").is_some() {
        return None;
    }
    let exe = std::env::current_exe().ok()?;
    let root = installation(&exe)?;
    let latest = known_latest(&cache_file()?)?;
    if !newer(&latest) {
        return None;
    }
    eprint!("NuclearLang {latest} is out (you have {CURRENT}). Update now? [Y/n] ");
    let _ = std::io::stderr().flush();
    let mut answer = String::new();
    std::io::stdin().read_line(&mut answer).ok()?;
    if !matches!(answer.trim().to_lowercase().as_str(), "" | "y" | "yes") {
        return None;
    }
    match run_installer(&root) {
        Ok(true) if cfg!(windows) => Some(ExitCode::SUCCESS),
        // the installer replaced the file at `exe`: the new binary runs the command
        Ok(true) => Some(match Command::new(&exe).args(args).status() {
            Ok(s) if s.success() => ExitCode::SUCCESS,
            _ => ExitCode::FAILURE,
        }),
        Ok(false) | Err(_) => {
            eprintln!("the update did not finish: your command runs on NuclearLang {CURRENT}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_version_of_the_redirect() {
        assert_eq!(version_of("https://github.com/nuclearlang/lang/releases/tag/v0.1.16"), Some("0.1.16"));
        assert_eq!(version_of("https://github.com/nuclearlang/lang/releases/latest"), None);
        assert_eq!(version_of(""), None);
    }

    #[test]
    fn compares_by_numbers() {
        assert!(parse("0.1.10") > parse("0.1.9"));
        assert!(parse("v1.0.0") > parse("0.99.99"));
        assert!(!newer(CURRENT));
        assert!(newer("999.0.0"));
        assert!(!newer("garbage"));
    }
}
