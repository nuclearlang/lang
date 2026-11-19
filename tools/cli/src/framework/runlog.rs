//! The project's run log, `<root>/.nuclear/logs/run.log`: what `nuclear run` did (its steps, the build's errors,
//! the server's own output, how it ended), so a person, the editor or an agent (MCP `project_run_log`) reads why a
//! run failed after the terminal is gone. The same format the editor's devices write: an ISO time and the line,
//! without colors, kept under 1 MB. A log that cannot be written never stops the run.

use std::fs::{self, OpenOptions};
use std::io::{IsTerminal, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const LIMIT: u64 = 1 << 20;
static WRITE: Mutex<()> = Mutex::new(());

pub struct RunLog {
    file: PathBuf,
}

impl RunLog {
    /// The log of the project at `root`, with a header line for this run.
    pub fn start(root: &Path, what: &str) -> RunLog {
        let log = RunLog { file: root.join(".nuclear").join("logs").join("run.log") };
        log.line(&format!("--- {what}"));
        log
    }

    pub fn step(&self, step: &str) {
        self.line(&format!("step: {step}"));
    }

    /// Each non-empty line of `text`, with its time and without its colors.
    pub fn line(&self, text: &str) {
        let at = timestamp(SystemTime::now());
        let lines: String = strip_ansi(text)
            .split('\n')
            .map(|l| l.trim_end_matches('\r'))
            .filter(|l| !l.trim().is_empty())
            .map(|l| format!("{at} {l}\n"))
            .collect();
        if lines.is_empty() {
            return;
        }
        let _one = WRITE.lock().unwrap_or_else(|e| e.into_inner());
        let _ = append(&self.file, &lines);
    }

    /// Runs `command` with its stdin the terminal's and its output both on the terminal (as it comes, colors kept)
    /// and in the log (line by line).
    pub fn tee(&self, command: &mut Command) -> std::io::Result<ExitStatus> {
        if std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none() {
            // piped, most tools drop their colors: the terminal still shows them
            command.env("FORCE_COLOR", "1").env("CLICOLOR_FORCE", "1");
        }
        let mut child = command.stdin(Stdio::inherit()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
        let out = child.stdout.take().map(|s| self.copy(s, false));
        let err = child.stderr.take().map(|s| self.copy(s, true));
        let status = child.wait();
        for t in [out, err].into_iter().flatten() {
            let _ = t.join();
        }
        status
    }

    fn copy(&self, mut from: impl Read + Send + 'static, err: bool) -> std::thread::JoinHandle<()> {
        let log = RunLog { file: self.file.clone() };
        std::thread::spawn(move || {
            let (mut buf, mut pending) = ([0u8; 8192], Vec::new());
            while let Ok(n) = from.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let _ = if err {
                    std::io::stderr().write_all(&buf[..n]).and_then(|_| std::io::stderr().flush())
                } else {
                    std::io::stdout().write_all(&buf[..n]).and_then(|_| std::io::stdout().flush())
                };
                pending.extend_from_slice(&buf[..n]);
                if let Some(end) = pending.iter().rposition(|b| *b == b'\n') {
                    log.line(&String::from_utf8_lossy(&pending[..end]));
                    pending.drain(..=end);
                }
            }
            log.line(&String::from_utf8_lossy(&pending));
        })
    }
}

fn append(file: &Path, lines: &str) -> std::io::Result<()> {
    fs::create_dir_all(file.parent().unwrap_or(Path::new(".")))?;
    OpenOptions::new().create(true).append(true).open(file)?.write_all(lines.as_bytes())?;
    if fs::metadata(file)?.len() > LIMIT {
        // the older half goes, from a line's start
        let all = fs::read(file)?;
        let half = all.len() / 2;
        let from = all[half..].iter().position(|b| *b == b'\n').map_or(all.len(), |p| half + p + 1);
        fs::write(file, &all[from..])?;
    }
    Ok(())
}

/// `text` without the escape sequences of colors and cursor moves.
pub fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\x1b' {
            out.push(c);
            continue;
        }
        match chars.next() {
            // CSI: parameters, then one final byte in @..~
            Some('[') => {
                for c in chars.by_ref() {
                    if ('@'..='~').contains(&c) {
                        break;
                    }
                }
            }
            // OSC (a link, a title): up to BEL or ESC \
            Some(']') => {
                while let Some(c) = chars.next() {
                    if c == '\x07' || (c == '\x1b' && chars.next_if_eq(&'\\').is_some()) {
                        break;
                    }
                }
            }
            _ => {}
        }
    }
    out
}

/// `2026-11-19T10:04:05.123Z`.
pub fn timestamp(at: SystemTime) -> String {
    let d = at.duration_since(UNIX_EPOCH).unwrap_or_default();
    let (secs, ms) = (d.as_secs() as i64, d.subsec_millis());
    let (days, rest) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // days since 1970-01-01 to a civil date (H. Hinnant's algorithm)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{ms:03}Z", rest / 3600, rest / 60 % 60, rest % 60)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn the_time_is_iso_8601_in_utc() {
        assert_eq!(timestamp(UNIX_EPOCH), "1970-01-01T00:00:00.000Z");
        assert_eq!(timestamp(UNIX_EPOCH + Duration::from_millis(1_795_087_445_123)), "2026-11-19T11:24:05.123Z");
        assert_eq!(timestamp(UNIX_EPOCH + Duration::from_secs(951_782_400)), "2000-02-29T00:00:00.000Z");
    }

    #[test]
    fn colors_and_links_are_stripped() {
        assert_eq!(strip_ansi("\x1b[1;32mINFO\x1b[0m:  Uvicorn running"), "INFO:  Uvicorn running");
        assert_eq!(strip_ansi("\x1b]8;;http://x\x1b\\link\x1b]8;;\x07 ok"), "link ok");
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("nuclear-runlog-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn steps_and_a_commands_output_go_to_the_log_with_their_time() {
        let root = scratch("tee");
        let log = RunLog::start(&root, "nuclear run");
        log.step("build");
        let mut cmd = if cfg!(windows) { Command::new("cmd") } else { Command::new("sh") };
        cmd.args(if cfg!(windows) {
            ["/C", "echo out& echo err 1>&2& exit 3"]
        } else {
            ["-c", "printf 'out\\n\\033[31merr\\033[0m' >&2; echo out; exit 3"]
        });
        let status = log.tee(&mut cmd).unwrap();
        assert_eq!(status.code(), Some(3));
        let text = fs::read_to_string(root.join(".nuclear/logs/run.log")).unwrap();
        let lines: Vec<&str> = text.lines().map(|l| l.split_once(' ').unwrap().1).collect();
        assert_eq!(&lines[..2], ["--- nuclear run", "step: build"]);
        assert!(lines.contains(&"err") && lines.contains(&"out"), "{lines:?}");
        assert!(text.lines().all(|l| l.as_bytes()[4] == b'-' && l.contains('T')));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn the_log_stays_under_a_megabyte_and_a_bad_place_writes_nothing() {
        let root = scratch("trim");
        let log = RunLog::start(&root, "nuclear run");
        let line = "x".repeat(1000);
        for _ in 0..1100 {
            log.line(&line);
        }
        let text = fs::read_to_string(root.join(".nuclear/logs/run.log")).unwrap();
        assert!(text.len() as u64 <= LIMIT && text.len() > 1000);
        assert!(text.lines().all(|l| l.ends_with(&line)));
        // a file where the folder should be: nothing written, no panic
        let blocked = scratch("blocked");
        fs::write(&blocked, "").unwrap();
        RunLog::start(&blocked, "nuclear run").step("build");
        let _ = fs::remove_file(&blocked);
        let _ = fs::remove_dir_all(&root);
    }
}
