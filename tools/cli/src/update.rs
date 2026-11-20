//! The update of an installation made by the public installers: `nuclear update`, and the question every run in a
//! terminal asks when a newer release is out. The latest version is asked at most once a day, waiting at most
//! three seconds (offline the command goes on), so the first run after an install already knows; the update itself is the public installer, run again (it keeps the choices
//! of the last install: `NUCLEAR_UPDATE=1`).

use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use std::io::{IsTerminal, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::{Duration, SystemTime};

const CURRENT: &str = env!("CARGO_PKG_VERSION");
const LATEST_URL: &str = "https://github.com/nuclearlang/lang/releases/latest";
const LATEST_API: &str = "https://api.github.com/repos/nuclearlang/lang/releases/latest";
const DAY: Duration = Duration::from_secs(24 * 60 * 60);
/// A question nobody answers (a script in a terminal) goes on as "no" after this.
const ANSWER_WAIT: Duration = Duration::from_secs(15);

/// The installation this binary runs from, when a public installer made it (its `.version`); a build from source
/// has none and is never updated here.
/// `exe` is resolved first: macOS gives the path it was started by (`~/.local/bin/nuclear`, the installer's link), not
/// the file in the installation that link points to, as Linux does.
fn installation(exe: &Path) -> Option<PathBuf> {
    let exe = std::fs::canonicalize(exe).unwrap_or_else(|_| exe.to_path_buf());
    let root = exe.parent()?.parent()?;
    root.join(".version").is_file().then(|| root.to_path_buf())
}

fn cache_dir() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_CACHE_HOME")
        .filter(|_| !cfg!(windows))
        .map(PathBuf::from)
        .or_else(|| std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(|h| PathBuf::from(h).join(".cache")))?;
    Some(base.join("nuclearlang"))
}

/// `1.2.3` (a leading `v` and anything after the third number aside) as numbers to compare.
fn parse(v: &str) -> Option<(u64, u64, u64)> {
    let mut n = v.trim().trim_start_matches('v').split(|c: char| !c.is_ascii_digit()).map(str::parse::<u64>);
    Some((n.next()?.ok()?, n.next()?.ok()?, n.next()?.ok()?))
}

/// The version in what the check wrote: the url `releases/latest` redirects to (`…/releases/tag/v0.1.16`, curl) or
/// the API's answer (`"tag_name": "v0.1.16"`, wget).
fn version_of(text: &str) -> Option<&str> {
    let tag = match text.trim().rsplit_once("/tag/") {
        Some((_, tag)) => tag,
        None => text.split_once("\"tag_name\"")?.1.split('"').nth(1)?,
    };
    parse(tag).map(|_| tag.trim_start_matches('v'))
}

fn newer(latest: &str) -> bool {
    matches!((parse(latest), parse(CURRENT)), (Some(l), Some(c)) if l > c)
}

fn younger_than_a_day(file: &Path) -> bool {
    let modified = std::fs::metadata(file).and_then(|m| m.modified());
    // a time in the future (a clock set back) counts as young: no new check on every run
    modified.is_ok_and(|t| SystemTime::now().duration_since(t).map_or(true, |age| age < DAY))
}

/// The latest release: what the last check found while it is younger than a day; else asked now, waiting at most
/// `CHECK_WAIT` (once a day, as Flutter and oh-my-zsh do), so the first run after an install already knows. Offline,
/// the old answer is used and nothing is asked again for a day.
fn known_latest(cache: &Path) -> Option<String> {
    let old = std::fs::read_to_string(cache).unwrap_or_default();
    if younger_than_a_day(cache) {
        return version_of(&old).map(String::from);
    }
    let fresh = fetch_latest();
    if let Some(dir) = cache.parent() {
        let _ = std::fs::create_dir_all(dir);
        // offline the old answer stays, with a new date: the next check is tomorrow, not on every run
        let _ = std::fs::write(cache, fresh.as_deref().unwrap_or(&old));
    }
    version_of(fresh.as_deref().unwrap_or(&old)).map(String::from)
}

/// The longest a command waits for the release check (once a day at most).
const CHECK_WAIT: &str = "3";

/// What curl (the url `releases/latest` redirects to) or wget (the API's answer) says of the latest release, or
/// `None` without network, without either tool, or past `CHECK_WAIT` seconds.
fn fetch_latest() -> Option<String> {
    let null = if cfg!(windows) { "NUL" } else { "/dev/null" };
    let mut curl = Command::new("curl");
    curl.args(["-fsSLI", "--connect-timeout", CHECK_WAIT, "--max-time", CHECK_WAIT, "-o", null, "-w", "%{url_effective}", LATEST_URL]);
    let mut wget = Command::new("wget");
    wget.args(["-qO-", &format!("--timeout={CHECK_WAIT}"), "--tries=1", LATEST_API]);
    for mut cmd in [curl, wget] {
        match cmd.stdin(Stdio::null()).stderr(Stdio::null()).output() {
            Ok(out) => {
                let text = String::from_utf8_lossy(&out.stdout).into_owned();
                return (out.status.success() && version_of(&text).is_some()).then_some(text);
            }
            Err(_) => continue, // this tool is not on the machine: the next one
        }
    }
    None
}

/// Under `sudo`: the installers need no administrator (ADR-installer-0005), and an update as root would leave files
/// of root in the user's installation. Root's own installation (a container) is updated as any other.
fn as_root() -> bool {
    #[cfg(unix)]
    {
        // SAFETY: geteuid has no preconditions and cannot fail
        let root = unsafe { libc::geteuid() == 0 };
        root && std::env::var("SUDO_USER").is_ok_and(|u| !u.is_empty() && u != "root")
    }
    #[cfg(not(unix))]
    false
}

/// Runs the public installer for the installation at `root`. On Windows it opens in a window of its own: the
/// installer replaces `nuclear.exe`, which cannot happen while this process runs.
fn run_installer(root: &Path, reinstall: bool) -> std::io::Result<bool> {
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
    cmd.env("NUCLEAR_INSTALL", root).env("NUCLEAR_UPDATE", "1");
    if reinstall {
        cmd.env("NUCLEAR_REINSTALL", "1");
    }
    Ok(cmd.status()?.success())
}

/// What `NUCLEAR_UPDATE_DRYRUN=1 nuclear update` prints instead of running the installer.
fn dry_run(root: &Path, reinstall: bool) -> String {
    let script = if cfg!(windows) { "install.ps1" } else { "install.sh" };
    let again = if reinstall { " NUCLEAR_REINSTALL=1" } else { "" };
    format!(
        "would run https://nuclearlang.github.io/{script} with NUCLEAR_INSTALL={} NUCLEAR_UPDATE=1{again}",
        root.display()
    )
}

/// Nothing to update: the latest release (asked now) is this binary's, and the AI services are of it too. Offline
/// (no answer) is not "up to date": the installer is run and says what it can.
fn up_to_date(root: &Path, latest: Option<&str>) -> bool {
    let ai = std::fs::read_to_string(root.join("ai").join(".version")).ok();
    latest.is_some_and(|l| !newer(l)) && ai.is_none_or(|v| v.trim() == CURRENT)
}

/// `nuclear update [--reinstall]`: the latest release, now; when it is already here, nothing (`--reinstall`: the
/// installer again all the same).
pub fn command(args: &[String]) -> ExitCode {
    if as_root() {
        eprintln!("nuclear update does not run under sudo: run it as the user who installed NuclearLang");
        return ExitCode::from(2);
    }
    let Some(root) = std::env::current_exe().ok().as_deref().and_then(installation) else {
        eprintln!("this nuclear was not installed by the NuclearLang installer: update it the way it was installed");
        return ExitCode::from(2);
    };
    let reinstall = args.iter().any(|a| a == "--reinstall");
    // the delivery tests (installer/tests/run.sh, UPD1): the installation found through the link, nothing run
    if std::env::var_os("NUCLEAR_UPDATE_DRYRUN").is_some_and(|v| v == "1") {
        println!("{}", dry_run(&root, reinstall));
        return ExitCode::SUCCESS;
    }
    if !reinstall {
        let latest = fetch_latest();
        if up_to_date(&root, latest.as_deref().and_then(version_of)) {
            println!("NuclearLang {CURRENT} is the latest release: nothing to update (nuclear update --reinstall installs it again)");
            return ExitCode::SUCCESS;
        }
    }
    match run_installer(&root, reinstall) {
        Ok(true) => ExitCode::SUCCESS,
        Ok(false) => ExitCode::FAILURE,
        Err(e) => {
            eprintln!("cannot run the installer: {e}");
            ExitCode::FAILURE
        }
    }
}

enum Answer {
    Yes,
    No,
    Later,
}

/// One key, without echo and without reading a line: what the command reads from the terminal afterwards stays its
/// own. No key within `ANSWER_WAIT` (a script in a terminal) is a no.
fn ask() -> Answer {
    if crossterm::terminal::enable_raw_mode().is_err() {
        return Answer::No;
    }
    let deadline = std::time::Instant::now() + ANSWER_WAIT;
    let answer = loop {
        let left = deadline.saturating_duration_since(std::time::Instant::now());
        if left.is_zero() || !event::poll(left).unwrap_or(false) {
            break None;
        }
        if let Ok(Event::Key(k)) = event::read()
            && k.kind == KeyEventKind::Press
        {
            break match k.code {
                KeyCode::Enter | KeyCode::Char('y' | 'Y') => Some(Answer::Yes),
                KeyCode::Char('l' | 'L') => Some(Answer::Later),
                _ => Some(Answer::No),
            };
        }
    };
    let _ = crossterm::terminal::disable_raw_mode();
    match answer {
        Some(a) => {
            eprintln!("{}", match a { Answer::Yes => "yes", Answer::No => "no", Answer::Later => "later (asked again tomorrow)" });
            a
        }
        None => {
            eprintln!("no answer: going on (nuclear update installs it at any time)");
            Answer::No
        }
    }
}

/// Before a command, in a terminal: when a newer release is known, asks whether to update. On a yes the update runs
/// and the command is run again by the new binary (its exit code returned); otherwise the command goes on (`None`).
/// Never asked without a terminal (editors, agents, pipes, CI), inside `make` or an npm script, under sudo, or with
/// `NUCLEAR_NO_UPDATE_CHECK`; "later" stops asking for a day.
pub fn offer(args: &[String]) -> Option<ExitCode> {
    let terminal = std::io::stdin().is_terminal() && std::io::stdout().is_terminal() && std::io::stderr().is_terminal();
    let quiet = ["CI", "NUCLEAR_NO_UPDATE_CHECK", "MAKELEVEL", "npm_lifecycle_event"].iter().any(|v| std::env::var_os(v).is_some());
    if !terminal || quiet || as_root() {
        return None;
    }
    let exe = std::env::current_exe().ok()?;
    let root = installation(&exe)?;
    let dir = cache_dir()?;
    let latest = known_latest(&dir.join("latest-release"))?;
    let later = dir.join("update-later");
    if !newer(&latest) || younger_than_a_day(&later) {
        return None;
    }
    eprint!("NuclearLang {latest} is out (you have {CURRENT}). Update now? [Y]es / [n]o / [l]ater ");
    let _ = std::io::stderr().flush();
    match ask() {
        Answer::Yes => {}
        Answer::No => return None,
        Answer::Later => {
            let _ = std::fs::write(&later, &latest);
            return None;
        }
    }
    match run_installer(&root, false) {
        Ok(true) if cfg!(windows) => Some(ExitCode::SUCCESS),
        // the installer replaced the file at `exe`: the new binary runs the command
        Ok(true) => Some(match Command::new(&exe).args(args).status() {
            Ok(s) if s.success() => ExitCode::SUCCESS,
            _ => ExitCode::FAILURE,
        }),
        Ok(false) | Err(_) => {
            eprintln!("the update did not finish (its message is above): nuclear update goes on from where it stopped");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn up_to_date_only_when_the_latest_and_the_ai_services_are_this_version() {
        let dir = std::env::temp_dir().join(format!("nuclear-update-same-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("ai")).unwrap();
        assert!(up_to_date(&dir, Some(CURRENT)), "no AI services: the binary decides");
        assert!(!up_to_date(&dir, Some("999.0.0")), "a newer release");
        assert!(!up_to_date(&dir, None), "offline is not up to date");
        std::fs::write(dir.join("ai/.version"), "0.0.1\n").unwrap();
        assert!(!up_to_date(&dir, Some(CURRENT)), "AI services of another version");
        std::fs::write(dir.join("ai/.version"), format!("{CURRENT}\n")).unwrap();
        assert!(up_to_date(&dir, Some(CURRENT)));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn the_installation_is_found_through_the_installers_link() {
        let dir = std::env::temp_dir().join(format!("nuclear-update-link-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("inst/bin")).unwrap();
        std::fs::create_dir_all(dir.join("local/bin")).unwrap();
        std::fs::write(dir.join("inst/.version"), "0.82.1").unwrap();
        std::fs::write(dir.join("inst/bin/nuclear"), "").unwrap();
        std::os::unix::fs::symlink(dir.join("inst/bin/nuclear"), dir.join("local/bin/nuclear")).unwrap();
        // what macOS's current_exe gives: the link the user ran, not its target
        let found = installation(&dir.join("local/bin/nuclear")).unwrap();
        assert_eq!(found, std::fs::canonicalize(dir.join("inst")).unwrap());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_dry_run_names_the_installation_and_the_options() {
        let line = dry_run(Path::new("/x/nuclearlang"), true);
        assert!(line.contains("NUCLEAR_INSTALL=/x/nuclearlang NUCLEAR_UPDATE=1 NUCLEAR_REINSTALL=1"), "{line}");
        assert!(!dry_run(Path::new("/x"), false).contains("REINSTALL"));
    }

    #[test]
    fn reads_the_version_of_the_redirect_and_of_the_api() {
        assert_eq!(version_of("https://github.com/nuclearlang/lang/releases/tag/v0.1.16"), Some("0.1.16"));
        assert_eq!(version_of("{\n  \"url\": \"x\",\n  \"tag_name\": \"v0.80.0\",\n}"), Some("0.80.0"));
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

    #[test]
    fn a_missing_or_old_file_is_not_young() {
        let dir = std::env::temp_dir().join(format!("nuclear-update-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let f = dir.join("f");
        assert!(!younger_than_a_day(&f));
        std::fs::write(&f, "").unwrap();
        assert!(younger_than_a_day(&f));
        let old = std::fs::File::options().write(true).open(&f).unwrap();
        old.set_modified(SystemTime::now() - DAY * 2).unwrap();
        assert!(!younger_than_a_day(&f));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
