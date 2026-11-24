//! The monitor's collector of `nuclear run --monitor` (spec 015), for a web or mobile app run without the editor (the
//! editor runs its own, `extensions/tools/nuclear-monitor/src/collector.ts`, and gives it as `NUCLEAR_MONITOR_URL`):
//! an app in a browser (or on a phone) has no project files, so its runtime posts the report every two seconds to
//! `http://127.0.0.1:<port>/<token>/<project key>`, and this writes it to `<project>/.nuclear/monitor/report.json`,
//! where `nuclear monitor` reads it. Only this machine (127.0.0.1), only with the token of this run, only from the
//! app's own origin (CORS: a browser always says it; a phone's app names none).

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// A report larger than this is refused (a real one is a few hundred kilobytes).
const MAX_BODY: usize = 8 << 20;

/// What the collector accepts: its token, the project it writes for and the app's port (any port of this machine
/// when the app has none yet).
#[derive(Clone)]
pub struct Collector {
    token: String,
    key: String,
    root: PathBuf,
    port: Option<u16>,
}

/// A token nobody can guess: two hashers of the process's random keys (128 bits).
fn token() -> String {
    let mut out = String::new();
    for i in 0..2u64 {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(i ^ u64::from(std::process::id()));
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

/// `nuclear run` of a measured web or mobile app with no collector given: starts one for `root` and sets
/// `NUCLEAR_MONITOR_URL` for the build and the commands this run starts. Nothing when the project is not measured
/// or the editor already runs a collector.
pub fn for_run(root: &Path, port: Option<u16>) {
    let measured = std::env::var_os("NUCLEAR_MONITOR").is_some() || root.join(".nuclear/monitor/on").is_file();
    if !measured || std::env::var_os("NUCLEAR_MONITOR_URL").is_some() {
        return;
    }
    let c = Collector { token: token(), key: crate::project_key(root), root: root.to_path_buf(), port };
    match c.start() {
        Ok(url) => {
            // SAFETY: set before this process starts the build or the app
            unsafe { std::env::set_var("NUCLEAR_MONITOR_URL", url) };
        }
        Err(e) => eprintln!("warning: the monitor's collector could not start ({e}): the app's report is not written"),
    }
}

impl Collector {
    /// Listens on a free port of 127.0.0.1 in a thread of its own; the address with the token.
    fn start(self) -> std::io::Result<String> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let url = format!("http://127.0.0.1:{}/{}", listener.local_addr()?.port(), self.token);
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let c = self.clone();
                std::thread::spawn(move || c.serve(stream));
            }
        });
        Ok(url)
    }

    fn serve(&self, mut stream: TcpStream) {
        let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
        let Ok(mut reader) = stream.try_clone().map(BufReader::new) else { return };
        let mut head = String::new();
        let (mut origin, mut length) = (None, 0usize);
        if reader.read_line(&mut head).is_err() {
            return;
        }
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).unwrap_or(0) == 0 || line.trim().is_empty() {
                break;
            }
            if let Some((name, value)) = line.split_once(':') {
                match name.trim().to_ascii_lowercase().as_str() {
                    "origin" => origin = Some(value.trim().to_string()),
                    "content-length" => length = value.trim().parse().unwrap_or(usize::MAX),
                    _ => {}
                }
            }
        }
        let mut words = head.split_whitespace();
        let (method, path) = (words.next().unwrap_or_default(), words.next().unwrap_or_default());
        let mut body = Vec::new();
        if method == "POST" && length <= MAX_BODY {
            body.resize(length, 0);
            if reader.read_exact(&mut body).is_err() {
                return;
            }
        }
        let (status, allow) = self.answer(method, path, origin.as_deref(), length, &body);
        let cors = allow
            .map(|o| format!("Access-Control-Allow-Origin: {o}\r\nAccess-Control-Allow-Methods: POST\r\nAccess-Control-Allow-Headers: content-type\r\nVary: Origin\r\n"))
            .unwrap_or_default();
        let _ = write!(stream, "HTTP/1.1 {status}\r\n{cors}Content-Length: 0\r\nConnection: close\r\n\r\n");
    }

    /// The answer to a request: its status and the origin CORS allows (the app's, else none).
    fn answer(
        &self,
        method: &str,
        path: &str,
        origin: Option<&str>,
        length: usize,
        body: &[u8],
    ) -> (&'static str, Option<String>) {
        let allowed = match origin {
            None => true,
            Some(o) => self.allows(o),
        };
        if path != format!("/{}/{}", self.token, self.key) || !allowed {
            return ("403 Forbidden", None);
        }
        let allow = origin.map(str::to_string);
        match method {
            "OPTIONS" => ("204 No Content", allow),
            "POST" if length > MAX_BODY => ("413 Payload Too Large", allow),
            "POST" => match serde_json::from_slice::<serde_json::Value>(body) {
                Ok(r) if r["format"].is_u64() && r["roots"].is_array() => match write_report(&self.root, body) {
                    Ok(()) => ("204 No Content", allow),
                    Err(_) => ("500 Internal Server Error", allow),
                },
                _ => ("400 Bad Request", allow),
            },
            _ => ("405 Method Not Allowed", allow),
        }
    }

    /// An origin of this machine at the app's port (any port when the app has none yet).
    fn allows(&self, origin: &str) -> bool {
        let Some(rest) = origin.strip_prefix("http://") else { return false };
        let Some((host, port)) = rest.rsplit_once(':') else { return false };
        let local = matches!(host, "127.0.0.1" | "localhost" | "[::1]");
        local && port.parse::<u16>().is_ok_and(|p| self.port.is_none_or(|want| want == p))
    }
}

/// The report written whole (a reader never sees half of it).
fn write_report(root: &Path, body: &[u8]) -> std::io::Result<()> {
    let file = root.join(crate::MONITOR_REPORT);
    std::fs::create_dir_all(file.parent().unwrap_or(root))?;
    let tmp = file.with_extension("json.tmp");
    std::fs::write(&tmp, body)?;
    std::fs::rename(tmp, file)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn post(url: &str, origin: Option<&str>, body: &str) -> String {
        let rest = url.strip_prefix("http://").unwrap();
        let (addr, path) = rest.split_once('/').unwrap();
        let mut s = TcpStream::connect(addr).unwrap();
        let origin = origin.map(|o| format!("Origin: {o}\r\n")).unwrap_or_default();
        write!(s, "POST /{path} HTTP/1.1\r\nHost: {addr}\r\n{origin}Content-Type: text/plain\r\nContent-Length: {}\r\n\r\n{body}", body.len()).unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        out
    }

    #[test]
    fn the_collector_writes_the_report_only_with_its_token_and_from_the_apps_origin() {
        let root = std::env::temp_dir().join(format!("nuclear-collector-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let c = Collector { token: token(), key: crate::project_key(&root), root: root.clone(), port: Some(5199) };
        let (token, key) = (c.token.clone(), c.key.clone());
        let base = c.start().unwrap();
        let url = format!("{base}/{key}");
        let report = r#"{"format":1,"app":"web","roots":[]}"#;
        let file = root.join(crate::MONITOR_REPORT);
        // another token, another project, another origin, a body that is not a report: refused, nothing written
        let wrong = url.replace(&token, &"0".repeat(32));
        assert!(post(&wrong, Some("http://127.0.0.1:5199"), report).starts_with("HTTP/1.1 403"));
        assert!(post(&format!("{base}/0000000000000000"), None, report).starts_with("HTTP/1.1 403"));
        assert!(post(&url, Some("http://evil.example:5199"), report).starts_with("HTTP/1.1 403"));
        assert!(post(&url, Some("http://127.0.0.1:5200"), report).starts_with("HTTP/1.1 403"));
        assert!(post(&url, Some("http://localhost:5199"), "{}").starts_with("HTTP/1.1 400"));
        assert!(!file.exists());
        // the app's page: written, and CORS allows that origin only
        let ok = post(&url, Some("http://localhost:5199"), report);
        assert!(ok.starts_with("HTTP/1.1 204"), "{ok}");
        assert!(ok.contains("Access-Control-Allow-Origin: http://localhost:5199"));
        assert_eq!(std::fs::read_to_string(&file).unwrap(), report);
        // a phone's app (no origin) with the token
        assert!(post(&url, None, report).starts_with("HTTP/1.1 204"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn the_address_given_to_the_build_is_of_this_machine_and_safe_in_a_string() {
        let root = Path::new(".");
        let key = crate::project_key(root);
        assert_eq!(
            crate::collector_url("http://127.0.0.1:4100/abc", root),
            Some(format!("http://127.0.0.1:4100/abc/{key}"))
        );
        assert_eq!(crate::collector_url("http://example.com:4100/abc", root), None);
        assert_eq!(crate::collector_url("http://127.0.0.1:4100/a'b", root), None);
        // the editor computes the same key: FNV-1a of the folder (the vector of collector.test.ts)
        assert_eq!(key.len(), 16);
        assert_eq!(crate::project_key(Path::new("/no/such/project")), "eebbee3a50ba7537");
    }
}
