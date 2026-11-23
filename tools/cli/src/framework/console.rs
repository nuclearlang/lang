//! The console of a project (`nuclear monitor`): its last run read from the run log (`runlog.rs`, written by
//! `nuclear run` and by the editor's devices), as what it is doing now (`state`) and its lines by kind: each request
//! of a backend (`<time> <METHOD> <path> <status> <ms>ms`), each error with its stack (the backend's
//! `<time> ERROR <METHOD> <path> <cause>` and the indented lines under it), the steps, the reloads, the app's own
//! output. The editor's Monitor and the agents (MCP `project_monitor`) read the same lines.

use serde_json::{Value, json};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::{Duration, SystemTime};

/// The lines kept of a run: the newest ones.
const MAX_LINES: usize = 1000;
/// A run whose log went silent this long before it was ready is taken as gone (a terminal closed, a crash).
const STALE_BEFORE_READY: Duration = Duration::from_secs(10 * 60);

const METHODS: &[&str] = &["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/// The run log of `root`: its last run (from its last `--- ` line) read at `now`. `answers` says whether the server's
/// address answers (a run with an address is running only while it does).
pub fn read(root: &Path, now: SystemTime, answers: &dyn Fn(&str) -> bool) -> Value {
    let text = std::fs::read_to_string(root.join(".nuclear").join("logs").join("run.log")).unwrap_or_default();
    session(&text, now, answers)
}

/// Whether something listens at `url`'s host and port (300 ms per address).
pub fn listening(url: &str) -> bool {
    let rest = url.split_once("://").map_or(url, |(_, r)| r);
    let host = rest.split('/').next().unwrap_or_default();
    let addr = if host.rsplit_once(':').is_some_and(|(_, p)| p.parse::<u16>().is_ok()) {
        host.to_string()
    } else {
        format!("{host}:{}", if url.starts_with("https") { 443 } else { 80 })
    };
    addr.to_socket_addrs()
        .map(|all| all.into_iter().any(|a| TcpStream::connect_timeout(&a, Duration::from_millis(300)).is_ok()))
        .unwrap_or(false)
}

/// `2026-11-23T10:00:00.123Z rest` → (time, rest).
fn split_time(line: &str) -> (&str, &str) {
    match line.split_once(' ') {
        Some((t, rest)) if t.len() >= 20 && t.as_bytes()[4] == b'-' && t.contains('T') && t.ends_with('Z') => (t, rest),
        _ => ("", line),
    }
}

/// `GET /films 200 3ms` (the app's own time before it, if any).
fn request(text: &str) -> Option<Value> {
    let words: Vec<&str> = split_time(text).1.split(' ').collect();
    let [method, path, status, took] = words[..] else { return None };
    let ms: f64 = took.strip_suffix("ms")?.parse().ok()?;
    // whole milliseconds stay whole: `3ms` is 3, not 3.0
    let ms = if ms.fract() == 0.0 && ms < 1e15 { json!(ms as u64) } else { json!(ms) };
    let status: u16 = status.parse().ok().filter(|s| (100..600).contains(s))?;
    (METHODS.contains(&method) && path.starts_with('/'))
        .then(|| json!({ "kind": "request", "method": method, "path": path, "status": status, "ms": ms }))
}

/// `ERROR GET /films KeyError: 'x'` (the app's own time before it, if any).
fn cause(text: &str) -> Option<Value> {
    let rest = split_time(text).1.strip_prefix("ERROR ")?;
    let mut words = rest.splitn(3, ' ');
    let (method, path, why) = (words.next()?, words.next()?, words.next().unwrap_or_default());
    (METHODS.contains(&method) && path.starts_with('/'))
        .then(|| json!({ "kind": "error", "method": method, "path": path, "text": why, "stack": [] }))
}

/// An error that is not a request's: a build's, Flutter's, a crash's.
fn looks_failed(text: &str) -> bool {
    let t = text.trim_start();
    t.starts_with("error")
        || t.starts_with("Error")
        || t.starts_with("ERROR")
        || t.starts_with("Traceback")
        || t.contains("Exception")
        || t.starts_with("Unhandled")
        || t.starts_with("✗")
}

fn reloaded(text: &str) -> bool {
    ["Reloading", "Reloaded ", "Restarted application", "Performing hot re", "File change detected"]
        .iter()
        .any(|w| text.contains(w))
}

/// The last run of the log `text`, read at `now`.
pub fn session(text: &str, now: SystemTime, answers: &dyn Fn(&str) -> bool) -> Value {
    let all: Vec<&str> = text.lines().collect();
    let from = all.iter().rposition(|l| split_time(l).1.starts_with("--- ")).unwrap_or(0);
    let run = &all[from..];
    let (mut lines, mut step, mut url, mut ended, mut why) = (Vec::<Value>::new(), String::new(), None, None, None);
    let (mut requests, mut errors, mut failing) = (0, 0, 0);
    let mut last_at = "";
    let started = run.first().map(|l| split_time(l).0).unwrap_or_default();
    for raw in run {
        let (at, text) = split_time(raw);
        if !at.is_empty() {
            last_at = at;
        }
        let entry = if text.starts_with("--- ") || text.starts_with("$ ") || text.starts_with("step: environment") {
            None // the run's header, its commands, its environment: in the Details, not in the console
        } else if let Some(s) = text.strip_prefix("step: ") {
            let (name, address) = s.split_once(' ').map_or((s, None), |(n, a)| (n, Some(a)));
            step = name.to_string();
            if address.is_some() {
                url = address.map(str::to_string);
            }
            Some(json!({ "kind": "step", "text": name }))
        } else if let Some(code) = text.strip_prefix("exited: ") {
            ended = Some(code.to_string());
            Some(json!({ "kind": "end", "text": code }))
        } else if let Some(w) = text
            .strip_prefix("failed: ")
            .or_else(|| text.strip_prefix("failed at ").map(|r| r.split_once(": ").map_or(r, |(_, w)| w)))
        {
            ended = Some("failed".into());
            why = Some(w.to_string());
            Some(json!({ "kind": "failed", "text": w }))
        } else if let Some(r) = request(text) {
            requests += 1;
            if r["status"].as_u64().unwrap_or(0) >= 500 {
                failing += 1;
            }
            Some(r)
        } else if let Some(c) = cause(text) {
            errors += 1;
            Some(c)
        } else if text.starts_with(char::is_whitespace)
            && let Some(last) = lines.last_mut().filter(|l| l["kind"] == "error")
        {
            // a line of the error's stack
            if let Some(stack) = last["stack"].as_array_mut() {
                stack.push(json!(text));
            }
            None
        } else if looks_failed(text) {
            errors += 1;
            Some(json!({ "kind": "error", "text": text.trim(), "stack": [] }))
        } else if reloaded(text) {
            Some(json!({ "kind": "reload", "text": text }))
        } else {
            Some(json!({ "kind": "output", "text": text }))
        };
        if let Some(mut e) = entry {
            e["at"] = json!(at);
            lines.push(e);
        }
    }
    if lines.len() > MAX_LINES {
        lines.drain(..lines.len() - MAX_LINES);
    }
    let silent = parse_time(last_at).and_then(|t| now.duration_since(t).ok()).unwrap_or_default();
    let state = if run.is_empty() {
        "none"
    } else if let Some(code) = &ended {
        // Ctrl+C ends a server with a signal (or 130): stopped by the user, not a failure
        if code == "0" || code == "signal" || code == "130" { "stopped" } else { "failed" }
    } else if step == "live" || requests > 0 || url.as_deref().is_some_and(answers) {
        // a server with an address runs only while it answers; one that answered and stopped answering is gone
        if url.as_deref().is_some_and(|u| !answers(u)) { "stopped" } else { "running" }
    } else if silent > STALE_BEFORE_READY || (step == "serve" && url.is_some() && silent > Duration::from_secs(120)) {
        "stopped"
    } else if url.is_none() && step == "flutter" && silent > Duration::from_secs(30) {
        // `nuclear run` of a mobile app: Flutter keeps the terminal, so its lines are not here; it runs until `exited:`
        "running"
    } else {
        "starting"
    };
    json!({
        "state": state, "step": step, "url": url, "started": started, "updated": last_at, "why": why,
        "requests": requests, "errors": errors.max(failing), "lines": lines,
    })
}

/// `2026-11-23T10:00:00.123Z` as a time (UTC).
fn parse_time(t: &str) -> Option<SystemTime> {
    let n = |r: std::ops::Range<usize>| t.get(r).and_then(|s| s.parse::<i64>().ok());
    let (y, mo, d, h, mi, s) = (n(0..4)?, n(5..7)?, n(8..10)?, n(11..13)?, n(14..16)?, n(17..19)?);
    let ms = n(20..23).unwrap_or(0);
    // days from 1970-01-01 of a civil date (H. Hinnant's algorithm)
    let y = if mo <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (if mo > 2 { mo - 3 } else { mo + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    let ms_total = ((days * 86_400 + h * 3600 + mi * 60 + s) * 1000 + ms).max(0) as u64;
    Some(SystemTime::UNIX_EPOCH + Duration::from_millis(ms_total))
}

/// The console as text, for a terminal and the agents: the state, the counts, the last errors and requests.
pub fn render(c: &Value) -> String {
    let lines = c["lines"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    let mut out = format!(
        "console: {}{} · {} requests · {} errors\n",
        c["state"].as_str().unwrap_or_default(),
        c["url"].as_str().map(|u| format!(" at {u}")).unwrap_or_default(),
        c["requests"],
        c["errors"]
    );
    if let Some(w) = c["why"].as_str() {
        out.push_str(&format!("  why: {w}\n"));
    }
    let shown: Vec<&Value> = lines.iter().filter(|l| l["kind"] == "error" || l["kind"] == "request").collect();
    for l in &shown[shown.len().saturating_sub(20)..] {
        if l["kind"] == "request" {
            out.push_str(&format!(
                "  {} {} {} {}ms\n",
                l["method"].as_str().unwrap_or_default(),
                l["path"].as_str().unwrap_or_default(),
                l["status"],
                l["ms"]
            ));
        } else {
            let place = l["method"]
                .as_str()
                .map(|m| format!("{m} {} ", l["path"].as_str().unwrap_or_default()))
                .unwrap_or_default();
            out.push_str(&format!("  ERROR {place}{}\n", l["text"].as_str().unwrap_or_default()));
            for s in l["stack"].as_array().into_iter().flatten().take(12) {
                out.push_str(&format!("    {}\n", s.as_str().unwrap_or_default().trim()));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOG: &str = "\
2026-11-23T20:00:00.000Z --- nuclear run
2026-11-23T20:00:00.000Z step: build
2026-11-23T20:00:00.010Z $ nuclear build .
2026-11-23T20:00:00.050Z api: 20 files → ./build
2026-11-23T20:00:00.060Z step: environment development
2026-11-23T20:00:00.060Z step: serve http://localhost:8000
2026-11-23T20:00:01.000Z INFO:     Application startup complete.
2026-11-23T20:00:02.000Z 2026-11-23T20:00:02.000Z GET /films 200 3ms
2026-11-23T20:00:03.000Z 2026-11-23T20:00:03.000Z GET /nothing 404 1ms
2026-11-23T20:00:04.000Z 2026-11-23T20:00:04.000Z ERROR GET /films/x ValueError: invalid literal
2026-11-23T20:00:04.000Z   File \"/b/app/films.py\", line 12, in get
2026-11-23T20:00:04.000Z     return int(x)
2026-11-23T20:00:04.001Z 2026-11-23T20:00:04.001Z GET /films/x 500 2ms
2026-11-23T20:00:05.000Z WARNING:  StatReload detected changes in 'app/x.py'. Reloading...
";

    fn at(t: &str) -> SystemTime {
        parse_time(t).unwrap()
    }

    #[test]
    fn a_runs_requests_errors_and_stack_are_read_in_order() {
        let c = session(LOG, at("2026-11-23T20:00:06.000Z"), &|_| true);
        assert_eq!(c["state"], "running");
        assert_eq!(c["url"], "http://localhost:8000");
        assert_eq!((c["requests"].as_u64(), c["errors"].as_u64()), (Some(3), Some(1)));
        let kinds: Vec<&str> = c["lines"].as_array().unwrap().iter().map(|l| l["kind"].as_str().unwrap()).collect();
        assert_eq!(kinds, ["step", "output", "step", "output", "request", "request", "error", "request", "reload"]);
        let err = &c["lines"][6];
        assert_eq!((err["method"].as_str(), err["path"].as_str()), (Some("GET"), Some("/films/x")));
        assert_eq!(err["text"], "ValueError: invalid literal");
        assert_eq!(err["stack"].as_array().unwrap().len(), 2);
        assert_eq!(c["lines"][5]["status"], 404);
        assert_eq!(c["lines"][4]["at"], "2026-11-23T20:00:02.000Z");
        assert!(render(&c).contains("ERROR GET /films/x ValueError"));
    }

    #[test]
    fn the_state_says_starting_stopped_failed_or_none() {
        let starting = "2026-11-23T20:00:00.000Z --- nuclear run\n2026-11-23T20:00:00.000Z step: build\n";
        assert_eq!(session(starting, at("2026-11-23T20:00:30.000Z"), &|_| false)["state"], "starting");
        // silent for an hour before it was ready: the terminal is gone
        assert_eq!(session(starting, at("2026-11-23T21:00:00.000Z"), &|_| false)["state"], "stopped");
        // it served and its address no longer answers
        assert_eq!(session(LOG, at("2026-11-23T20:00:06.000Z"), &|_| false)["state"], "stopped");
        let failed = format!(
            "{starting}2026-11-23T20:00:01.000Z error[E0101]: unknown name\n2026-11-23T20:00:01.000Z failed: nuclear build . failed (exit code 2)\n"
        );
        let c = session(&failed, at("2026-11-23T20:00:02.000Z"), &|_| false);
        assert_eq!((c["state"].as_str(), c["step"].as_str()), (Some("failed"), Some("build")));
        assert_eq!(c["why"], "nuclear build . failed (exit code 2)");
        assert_eq!(c["errors"], 1);
        let device = "2026-11-23T20:00:00.000Z --- launch on the Synapsis device\n2026-11-23T20:00:00.000Z step: flutter\n2026-11-23T20:00:05.000Z failed at flutter: the app could not be launched.\n";
        assert_eq!(
            session(device, at("2026-11-23T20:00:06.000Z"), &|_| false)["why"],
            "the app could not be launched."
        );
        let stopped = format!("{LOG}2026-11-23T20:00:09.000Z exited: signal\n");
        assert_eq!(session(&stopped, at("2026-11-23T20:00:10.000Z"), &|_| true)["state"], "stopped");
        assert_eq!(session("", SystemTime::now(), &|_| true)["state"], "none");
        // only the last run counts
        let two = format!("{failed}{LOG}");
        assert_eq!(session(&two, at("2026-11-23T20:00:06.000Z"), &|_| true)["why"], Value::Null);
    }

    #[test]
    fn the_time_of_a_line_is_read_back() {
        let t = SystemTime::UNIX_EPOCH + Duration::from_millis(1_795_087_445_123);
        assert_eq!(parse_time(&crate::framework::runlog::timestamp(t)), Some(t));
        assert_eq!(
            parse_time("2000-02-29T00:00:00.000Z"),
            Some(SystemTime::UNIX_EPOCH + Duration::from_secs(951_782_400))
        );
    }

    #[test]
    fn an_address_that_nobody_listens_to_does_not_answer() {
        let free = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = free.local_addr().unwrap().port();
        assert!(listening(&format!("http://127.0.0.1:{port}/")));
        drop(free);
        assert!(!listening(&format!("http://127.0.0.1:{port}")));
    }
}
