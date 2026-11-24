//! The environments of a project (spec 021, ADR-platform-0012): the dotenv files beside `config.nuc`, the secrets in
//! the system's keyring, which environment a command runs in, and `nuclear env`. One resolver serves `run`, `build`,
//! `test`, `check`, `nuclear env`, the MCP server and the editor.
//!
//! Precedence, lowest first: `.env` < `.env.<environment>` < `.env.local` (not in `test`) < `.env.<environment>.local`
//! < the keyring's secrets < the real process environment.

use std::collections::BTreeMap;
use std::path::Path;

use nuclear_diag::{Diagnostic, Span, codes};
use serde_json::{Value, json};

/// The keyring's service of every secret; the account is `<project>-<key>/<environment>/<NAME>` (`KEY_FILE`).
pub const SERVICE: &str = "nuclearlang-env";
/// The project's active environment (`nuclear env use <name>`).
pub const ACTIVE_FILE: &str = ".nuclear/env";
/// Which variables of each environment are secrets and where each is kept (`keyring`, or the `.local` file when the
/// system has no keyring): names only, never a value.
pub const SECRETS_FILE: &str = ".nuclear/secrets.json";
/// The project's own key in the keyring's accounts: two projects of one machine with the same name never share a
/// secret. Made with the first secret; beside `SECRETS_FILE`, which forgets the secrets with it.
pub const KEY_FILE: &str = ".nuclear/env-key";
pub const DEFAULT: &str = "development";
pub const TEST: &str = "test";
/// The variable of a web or mobile app's backend (`Http(baseUrl = env("API_URL", ...))`).
pub const API_URL: &str = "API_URL";

// ---------- the format ----------

/// Parses a dotenv file: `NAME=value`, `export NAME=value`, `#` comments (a whole line, or after an unquoted value
/// and a space), single quotes (literal), double quotes (`\n`, `\r`, `\t`, `\"`, `\\`, `\$`; several lines), and
/// `${OTHER}` / `${OTHER:-default}` in unquoted and double-quoted values: a variable defined above in the file, else
/// `lookup`. The pairs come in file order.
pub fn parse(text: &str, lookup: &dyn Fn(&str) -> Option<String>) -> Result<Vec<(String, String)>, String> {
    let mut out: Vec<(String, String)> = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    let mut line = 1;
    let at = |line: usize, m: &str| format!("line {line}: {m}");
    while i < chars.len() {
        // spaces, empty lines and comment lines
        match chars[i] {
            '\n' => {
                line += 1;
                i += 1;
                continue;
            }
            c if c.is_whitespace() => {
                i += 1;
                continue;
            }
            '#' => {
                while i < chars.len() && chars[i] != '\n' {
                    i += 1;
                }
                continue;
            }
            _ => {}
        }
        let start = line;
        let mut name = word(&chars, &mut i);
        if name == "export" && chars.get(i).is_some_and(|c| *c == ' ' || *c == '\t') {
            skip_blanks(&chars, &mut i);
            name = word(&chars, &mut i);
        }
        if !valid_name(&name) {
            return Err(at(start, "expected NAME=value (a name of letters, digits and _)"));
        }
        skip_blanks(&chars, &mut i);
        if chars.get(i) != Some(&'=') {
            return Err(at(start, &format!("expected = after {name}")));
        }
        i += 1;
        skip_blanks(&chars, &mut i);
        let defined = |n: &str| out.iter().rev().find(|(k, _)| k == n).map(|(_, v)| v.clone()).or_else(|| lookup(n));
        let value = match chars.get(i) {
            Some('\'') => {
                i += 1;
                let mut v = String::new();
                loop {
                    match chars.get(i) {
                        None => return Err(at(start, &format!("the value of {name} has no closing '"))),
                        Some('\'') => break,
                        Some(c) => {
                            line += usize::from(*c == '\n');
                            v.push(*c);
                        }
                    }
                    i += 1;
                }
                i += 1;
                v
            }
            Some('"') => {
                i += 1;
                let mut raw = String::new();
                loop {
                    match chars.get(i) {
                        None => return Err(at(start, &format!("the value of {name} has no closing \""))),
                        Some('"') => break,
                        Some('\\') => {
                            i += 1;
                            match chars.get(i) {
                                Some('n') => raw.push('\n'),
                                Some('r') => raw.push('\r'),
                                Some('t') => raw.push('\t'),
                                // a `$` that is not an expansion: kept for `expand` as `\u{0}`
                                Some('$') => raw.push('\u{0}'),
                                Some(c @ ('"' | '\\')) => raw.push(*c),
                                Some(c) => {
                                    raw.push('\\');
                                    raw.push(*c);
                                }
                                None => return Err(at(start, &format!("the value of {name} has no closing \""))),
                            }
                        }
                        Some(c) => {
                            line += usize::from(*c == '\n');
                            raw.push(*c);
                        }
                    }
                    i += 1;
                }
                i += 1;
                expand(&raw, &defined).replace('\u{0}', "$")
            }
            _ => {
                let mut raw = String::new();
                while let Some(c) = chars.get(i) {
                    if *c == '\n' || (*c == '#' && raw.ends_with([' ', '\t'])) {
                        break;
                    }
                    raw.push(*c);
                    i += 1;
                }
                expand(raw.trim_end(), &defined)
            }
        };
        // after a quoted value: only spaces and a comment
        skip_blanks(&chars, &mut i);
        if chars.get(i) == Some(&'#') {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
        }
        if i < chars.len() && chars[i] != '\n' {
            return Err(at(line, &format!("unexpected text after the value of {name}")));
        }
        out.push((name, value));
    }
    Ok(out)
}

fn word(chars: &[char], i: &mut usize) -> String {
    let mut w = String::new();
    while let Some(c) = chars.get(*i).filter(|c| c.is_ascii_alphanumeric() || **c == '_') {
        w.push(*c);
        *i += 1;
    }
    w
}

fn skip_blanks(chars: &[char], i: &mut usize) {
    while chars.get(*i).is_some_and(|c| *c == ' ' || *c == '\t') {
        *i += 1;
    }
}

/// `${NAME}` and `${NAME:-default}` replaced; anything else is kept as it is.
fn expand(raw: &str, defined: &dyn Fn(&str) -> Option<String>) -> String {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(p) = rest.find("${") {
        out.push_str(&rest[..p]);
        let Some(end) = rest[p..].find('}') else {
            out.push_str(&rest[p..]);
            return out;
        };
        let inner = &rest[p + 2..p + end];
        let (name, fallback) = inner.split_once(":-").map_or((inner, None), |(n, d)| (n, Some(d)));
        match defined(name).filter(|v| !v.is_empty() || fallback.is_none()) {
            Some(v) => out.push_str(&v),
            None => out.push_str(fallback.unwrap_or("")),
        }
        rest = &rest[p + end + 1..];
    }
    out.push_str(rest);
    out
}

pub fn valid_name(name: &str) -> bool {
    name.chars().next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn valid_environment(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// A value written back to a file: as it is when it is plain, else in double quotes with its escapes.
fn quoted(value: &str) -> String {
    if !value.is_empty() && value.chars().all(|c| c.is_ascii_alphanumeric() || "_-./:@,+%".contains(c)) {
        return value.to_string();
    }
    let mut s = String::from("\"");
    for c in value.chars() {
        match c {
            '"' => s.push_str("\\\""),
            '\\' => s.push_str("\\\\"),
            '\n' => s.push_str("\\n"),
            '\r' => s.push_str("\\r"),
            '$' => s.push_str("\\$"),
            c => s.push(c),
        }
    }
    s.push('"');
    s
}

// ---------- which environment ----------

/// The environment `--env` names on this command line (main takes it out and puts it in `NUCLEAR_ENV` for the
/// commands it runs): only then do `check` and `build` report required variables without a value.
static EXPLICIT: std::sync::OnceLock<String> = std::sync::OnceLock::new();

/// Takes `--env <name>` out of a command line of `run`, `build`, `test`, `check` (never of `nuclear env`, whose
/// `--env` is its own) and sets `NUCLEAR_ENV`. Called first thing, before any thread.
pub fn take_flag_of_command(raw: &mut Vec<String>) -> Result<(), String> {
    if raw.first().is_some_and(|c| c == "env") {
        return Ok(());
    }
    let Some(i) = raw.iter().take_while(|a| *a != "--").position(|a| a == "--env") else { return Ok(()) };
    raw.remove(i);
    let name = (i < raw.len()).then(|| raw.remove(i)).ok_or("--env needs the name of an environment")?;
    if !valid_environment(&name) {
        return Err(format!("'{name}' is not a name of an environment (letters, digits, - and _)"));
    }
    // SAFETY: called by main before any thread or command starts
    unsafe { std::env::set_var("NUCLEAR_ENV", &name) };
    let _ = EXPLICIT.set(name);
    Ok(())
}

/// The environment `--env` named, if any.
pub fn explicit() -> Option<&'static str> {
    EXPLICIT.get().map(String::as_str)
}

/// The environment of a command: `--env` (main puts it in `NUCLEAR_ENV`), else `NUCLEAR_ENV`, else the project's
/// active one, else `fallback` (`development`; `nuclear test` passes `test` in `NUCLEAR_ENV` itself).
pub fn chosen(root: &Path, fallback: &str) -> String {
    std::env::var("NUCLEAR_ENV")
        .ok()
        .filter(|e| !e.is_empty())
        .or_else(|| active(root))
        .unwrap_or_else(|| fallback.to_string())
}

/// The project's active environment (`.nuclear/env`).
pub fn active(root: &Path) -> Option<String> {
    std::fs::read_to_string(root.join(ACTIVE_FILE)).ok().map(|t| t.trim().to_string()).filter(|t| valid_environment(t))
}

/// The files of an environment, lowest precedence first.
pub fn files(environment: &str) -> Vec<String> {
    let mut f = vec![".env".to_string(), format!(".env.{environment}")];
    if environment != TEST {
        f.push(".env.local".into());
    }
    f.push(format!(".env.{environment}.local"));
    f
}

/// Every environment the project names: `development`, the `.env.<name>` files, the secrets and the active one.
pub fn environments(root: &Path) -> Vec<String> {
    let mut names = std::collections::BTreeSet::new();
    for e in std::fs::read_dir(root).into_iter().flatten().flatten() {
        let file = e.file_name().to_string_lossy().into_owned();
        if let Some(rest) = file.strip_prefix(".env.") {
            let name = rest.strip_suffix(".local").unwrap_or(rest);
            if name != "local" && valid_environment(name) {
                names.insert(name.to_string());
            }
        }
    }
    names.extend(secrets(root).keys().cloned());
    names.extend(active(root));
    names.remove(DEFAULT);
    std::iter::once(DEFAULT.to_string()).chain(names).collect()
}

// ---------- secrets ----------

/// `SECRETS_FILE`: environment → name → where it is kept (`keyring` or a `.local` file).
fn secrets(root: &Path) -> BTreeMap<String, BTreeMap<String, String>> {
    std::fs::read_to_string(root.join(SECRETS_FILE)).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn write_secrets(root: &Path, s: &BTreeMap<String, BTreeMap<String, String>>) -> Result<(), String> {
    let path = root.join(SECRETS_FILE);
    std::fs::create_dir_all(path.parent().expect("in .nuclear")).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(s).map_err(|e| e.to_string())? + "\n";
    std::fs::write(&path, text).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

/// The project's key (`KEY_FILE`), made when `create` and missing: 16 hex digits from the std's random hasher seed.
fn project_key(root: &Path, create: bool) -> Result<String, String> {
    let path = root.join(KEY_FILE);
    if let Ok(k) = std::fs::read_to_string(&path) {
        let k = k.trim().to_string();
        if !k.is_empty() {
            return Ok(k);
        }
    }
    if !create {
        return Err(format!("{KEY_FILE} is missing"));
    }
    use std::hash::{BuildHasher, Hasher};
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write(root.to_string_lossy().as_bytes());
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    h.write_u32(std::process::id());
    let key = format!("{:016x}", h.finish());
    std::fs::create_dir_all(path.parent().expect("in .nuclear")).map_err(|e| e.to_string())?;
    std::fs::write(&path, format!("{key}\n")).map_err(|e| format!("cannot write {}: {e}", path.display()))?;
    Ok(key)
}

/// The keyring's account of a secret (`<project>-<key>/<environment>/<NAME>`).
fn account(root: &Path, project: &str, environment: &str, name: &str, create: bool) -> Result<String, String> {
    Ok(format!("{project}-{}/{environment}/{name}", project_key(root, create)?))
}

/// The system's keyring entry of a secret; `Err` when the system has none (or `NUCLEAR_KEYRING=off`).
fn keyring_entry(account: &str) -> Result<keyring::Entry, String> {
    if std::env::var("NUCLEAR_KEYRING").is_ok_and(|v| v == "off") {
        return Err("NUCLEAR_KEYRING=off".into());
    }
    keyring::Entry::new(SERVICE, account).map_err(|e| e.to_string())
}

// ---------- the values ----------

/// The value of a variable in an environment and where it comes from (a file, `keyring`, `process`).
#[derive(Debug, Clone, PartialEq)]
pub struct Resolved {
    pub value: String,
    pub source: String,
    pub secret: bool,
}

/// Every variable of `environment` with its value and source, by the precedence; the real process environment only
/// with `process` (a `.env` written into a build must not carry the machine's own variables). A secret the keyring
/// cannot give is left out with a warning.
pub fn resolve(root: &Path, project: &str, environment: &str, process: bool) -> Result<BTreeMap<String, Resolved>, String> {
    let mut out: BTreeMap<String, Resolved> = BTreeMap::new();
    let secret = secrets(root).remove(environment).unwrap_or_default();
    for file in files(environment) {
        let Ok(text) = std::fs::read_to_string(root.join(&file)) else { continue };
        let lookup = |n: &str| std::env::var(n).ok().or_else(|| out.get(n).map(|r| r.value.clone()));
        let pairs = parse(&text, &lookup).map_err(|e| format!("{file}, {e}"))?;
        for (name, value) in pairs {
            let is_secret = secret.get(&name).is_some_and(|w| *w == file);
            out.insert(name, Resolved { value, source: file.clone(), secret: is_secret });
        }
    }
    for (name, _) in secret.iter().filter(|(_, w)| *w == "keyring") {
        match account(root, project, environment, name, false).and_then(|a| keyring_entry(&a)).and_then(|e| e.get_password().map_err(|e| e.to_string())) {
            Ok(value) => {
                out.insert(name.clone(), Resolved { value, source: "keyring".into(), secret: true });
            }
            Err(e) => eprintln!("warning: the secret {name} of {environment} cannot be read from the keyring ({e})"),
        }
    }
    if process {
        for (name, value) in std::env::vars() {
            if let Some(r) = out.get_mut(&name) {
                *r = Resolved { value, source: "process".into(), secret: r.secret };
            } else {
                out.insert(name, Resolved { value, source: "process".into(), secret: false });
            }
        }
    }
    Ok(out)
}

/// The value of `name` in the project's own files of `environment` (no keyring, no process): what the project
/// sets for itself, such as its `PORT`.
pub fn file_value(root: &Path, environment: &str, name: &str) -> Option<String> {
    let lookup = |n: &str| std::env::var(n).ok();
    files(environment)
        .iter()
        .filter_map(|f| std::fs::read_to_string(root.join(f)).ok())
        .filter_map(|t| parse(&t, &lookup).ok())
        .flatten()
        .filter(|(k, _)| k == name)
        .map(|(_, v)| v)
        .next_back()
}

/// The variables the code declares (`env` of the contract the build wrote, `.nuclear/contract.json`).
pub fn declared(root: &Path) -> Vec<Value> {
    std::fs::read_to_string(root.join(nuclear_transpile::contract::CONTRACT_FILE))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|c| c["env"].as_array().cloned())
        .unwrap_or_default()
}

/// The required variables (no default) without a value in `values`, each with where it is used: what `nuclear run`
/// refuses to start without.
pub fn missing(declared: &[Value], values: &BTreeMap<String, Resolved>) -> Vec<String> {
    declared
        .iter()
        .filter(|v| v["required"] == true && v["name"].as_str().is_some_and(|n| !values.contains_key(n)))
        .map(|v| {
            let uses: Vec<String> = v["uses"]
                .as_array()
                .into_iter()
                .flatten()
                .map(|u| format!("{}:{}", u["file"].as_str().unwrap_or("?"), u["line"]))
                .collect();
            format!("{} (used in {})", v["name"].as_str().unwrap_or("?"), uses.join(", "))
        })
        .collect()
}

/// The refusal of `nuclear run` when required variables have no value.
pub fn refuse_missing(environment: &str, missing: &[String]) -> Result<(), String> {
    if missing.is_empty() {
        return Ok(());
    }
    Err(format!(
        "the environment {environment} has no value for {} required variable(s):\n  {}\n\ngive each one a value: nuclear env set <NAME> <value> --env {environment} (or --secret), or in .env.{environment}",
        missing.len(),
        missing.join("\n  ")
    ))
}

/// The values a client build carries (`Manifest::env`): every non-secret value with the process environment (the
/// compiler keeps only the variables the code reads).
pub fn client_values(values: &BTreeMap<String, Resolved>) -> BTreeMap<String, String> {
    values.iter().filter(|(_, r)| !r.secret).map(|(k, r)| (k.clone(), r.value.clone())).collect()
}

/// The diagnostics of a build for an environment at each `env()` that causes them: N0311 for a secret read by a
/// client; with `required`, N0312 for a required variable without a value (an error in `check --env`).
pub fn diagnose(source: &str, values: &BTreeMap<String, Resolved>, client: bool, required: bool, environment: &str) -> Vec<Diagnostic> {
    let parsed = nuclear_syntax::parse(source);
    let mut out = Vec::new();
    for u in nuclear_transpile::contract::env_uses(&parsed.file).0 {
        let span = Span { start: u.span.start, end: u.span.end };
        match values.get(&u.name) {
            Some(r) if client && r.secret => out.push(Diagnostic::error(
                codes::ENV_SECRET_CLIENT,
                span,
                format!("{} is a secret of {environment}: a web or mobile app cannot read it (its values are inside the build)", u.name),
            )),
            None if required && u.default.is_none() => out.push(Diagnostic::error(
                codes::ENV_MISSING,
                span,
                format!(
                    "{} is required (no default) and has no value in {environment}: nuclear env set {} <value> --env {environment}",
                    u.name, u.name
                ),
            )),
            _ => {}
        }
    }
    out
}

/// The environment of a build of a platform project: its name, its values, and whether the app is a client.
pub struct ForBuild {
    pub environment: String,
    pub values: BTreeMap<String, Resolved>,
    pub client: bool,
}

/// Before a build of a platform project (`None` for any other): the environment's values, and for a web or mobile app
/// the ones its build carries (`Manifest::env`, with the process environment, never a secret). In `development`, a
/// client of a workspace whose `API_URL` is not chosen (not given, or its `.env` only repeats the code's default)
/// calls the workspace's backend at the address `nuclear run` serves it on (`projects::workspace_backend`).
pub fn prepare(root: &Path, manifest: &mut nuclear_transpile::project::Manifest) -> Result<Option<ForBuild>, String> {
    if manifest.platform.is_none() {
        return Ok(None);
    }
    let client = matches!(manifest.platform.as_deref(), Some("web" | "mobile"));
    let environment = chosen(root, DEFAULT);
    let mut values = resolve(root, &manifest.name, &environment, client)?;
    // a value that only repeats the code's own default (the `.env` `nuclear new` writes) chooses nothing
    let default_of = |name: &str| declared(root).into_iter().find(|v| v["name"] == name).and_then(|v| v["default"].as_str().map(str::to_string));
    let chosen_url = values.get(API_URL).is_some_and(|r| r.source != ".env" || default_of(API_URL).as_deref() != Some(r.value.as_str()));
    if client
        && environment == DEFAULT
        && !chosen_url
        && let Some(url) = crate::framework::projects::workspace_backend(root)
    {
        values.insert(API_URL.into(), Resolved { value: format!("{url}/"), source: "projects".into(), secret: false });
    }
    if client {
        manifest.env = client_values(&values);
    }
    Ok(Some(ForBuild { environment, values, client }))
}

/// After the build: N0311 at each secret a client reads; with `--env`, N0312 at each required variable without a
/// value (a warning in `build` of a backend: where it runs, the real environment gives its secrets).
pub fn report(b: &ForBuild, out: &mut nuclear_transpile::project::ProjectOutput, building: bool) {
    let required = explicit().is_some();
    for f in out.files.iter_mut().filter(|f| !f.out_path.is_empty()) {
        let mut found = diagnose(&f.source, &b.values, b.client, required, &b.environment);
        if building && !b.client {
            found.iter_mut().for_each(|d| d.severity = nuclear_diag::Severity::Warning);
        }
        f.diagnostics.extend(found);
    }
}

/// Writes `<output>/.env` of a backend build: the resolved non-secret values of the files (never the process's, never
/// a secret), read by the runtime at start without replacing a variable the process has. Removed when there is none.
pub fn write_backend(out_dir: &Path, values: &BTreeMap<String, Resolved>, environment: &str) -> Result<(), String> {
    let path = out_dir.join(".env");
    let lines: Vec<String> =
        values.iter().filter(|(_, r)| !r.secret).map(|(k, r)| format!("{k}={}", quoted(&r.value))).collect();
    if lines.is_empty() {
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    let text = format!(
        "# Generated by NuclearLang: the environment {environment} (spec 021). Do not edit: nuclear env set, or the .env files of the project.\n{}\n",
        lines.join("\n")
    );
    if std::fs::read_to_string(&path).ok().as_deref() == Some(text.as_str()) {
        return Ok(());
    }
    std::fs::create_dir_all(out_dir).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

// ---------- the files, changed ----------

/// `NAME=value` set in a file of the project: the line of `NAME` replaced where it is, else added at the end.
fn set_in_file(path: &Path, name: &str, value: &str) -> Result<(), String> {
    let text = std::fs::read_to_string(path).unwrap_or_default();
    let line = format!("{name}={}", quoted(value));
    let (mut lines, found) = without(&text, name);
    match found {
        Some(at) => lines.insert(at, line),
        None => lines.push(line),
    }
    std::fs::write(path, lines.join("\n") + "\n").map_err(|e| format!("cannot write {}: {e}", path.display()))
}

/// `NAME` out of a file of the project; `false` when it was not there.
fn unset_in_file(path: &Path, name: &str) -> Result<bool, String> {
    let Ok(text) = std::fs::read_to_string(path) else { return Ok(false) };
    let (lines, found) = without(&text, name);
    if found.is_none() {
        return Ok(false);
    }
    let text = if lines.is_empty() { String::new() } else { lines.join("\n") + "\n" };
    std::fs::write(path, text).map_err(|e| format!("cannot write {}: {e}", path.display()))?;
    Ok(true)
}

/// The lines of a file without the assignment of `name` (its quoted value may take several lines), and where it was.
fn without(text: &str, name: &str) -> (Vec<String>, Option<usize>) {
    let mut out = Vec::new();
    let mut found = None;
    let mut lines = text.lines();
    while let Some(l) = lines.next() {
        let t = l.trim_start();
        let t = t.strip_prefix("export ").map_or(t, str::trim_start);
        let is_it = t.strip_prefix(name).is_some_and(|r| r.trim_start().starts_with('='));
        if !is_it {
            out.push(l.to_string());
            continue;
        }
        found.get_or_insert(out.len());
        // a quoted value that does not close on its line goes on until its closing quote
        let value = t.split_once('=').map_or("", |(_, v)| v.trim_start());
        if let Some(q) = value.chars().next().filter(|c| *c == '"' || *c == '\'') {
            let mut open = !closes(&value[1..], q);
            while open {
                match lines.next() {
                    Some(next) => open = !closes(next, q),
                    None => break,
                }
            }
        }
    }
    (out, found)
}

fn closes(text: &str, q: char) -> bool {
    let mut escaped = false;
    for c in text.chars() {
        if q == '"' && c == '\\' && !escaped {
            escaped = true;
            continue;
        }
        if c == q && !escaped {
            return true;
        }
        escaped = false;
    }
    false
}

// ---------- nuclear env ----------

pub const USAGE: &str = "usage:
  nuclear env list [--env <name>] [--json]      every variable (from the code and the files) × every environment
  nuclear env set <NAME> [<value>] [--env <name>] [--local] [--secret]
                                                a value in .env (or .env.<name>, .local versions); --secret: the system's
                                                keyring (no value argument: read from stdin, never printed)
  nuclear env unset <NAME> [--env <name>] [--local] [--secret]
  nuclear env envs [--json]                     the environments and the active one
  nuclear env use <name>                        the project's active environment (.nuclear/env)";

/// What `nuclear env` needs of the project: its folder, its name, and the variables its code declares.
pub struct Project<'a> {
    pub root: &'a Path,
    pub name: String,
    pub declared: Vec<Value>,
}

/// `nuclear env <list|set|unset|envs|use> ...`.
pub fn command(p: &Project, args: &[String]) -> Result<(), String> {
    let mut args = args.to_vec();
    let json = take_flag(&mut args, "--json");
    let local = take_flag(&mut args, "--local");
    let secret = take_flag(&mut args, "--secret");
    let environment = take_value(&mut args, "--env")?;
    if let Some(e) = environment.as_deref().filter(|e| !valid_environment(e)) {
        return Err(format!("'{e}' is not a name of an environment (letters, digits, - and _)"));
    }
    if let Some(flag) = args.iter().find(|a| a.starts_with("--")) {
        return Err(format!("unknown option {flag}\n{USAGE}"));
    }
    let words: Vec<&str> = args.iter().map(String::as_str).collect();
    match words.as_slice() {
        ["list"] | [] => {
            let out = list(p, environment.as_deref())?;
            if json {
                println!("{}", serde_json::to_string_pretty(&out).unwrap_or_default());
            } else {
                print!("{}", list_text(&out));
            }
            Ok(())
        }
        ["envs"] => {
            let active = chosen(p.root, DEFAULT);
            let all = environments(p.root);
            if json {
                println!("{}", json!({ "active": active, "environments": all }));
            } else {
                for e in all {
                    println!("{} {e}", if e == active { "*" } else { " " });
                }
            }
            Ok(())
        }
        ["use", name] => {
            if !valid_environment(name) {
                return Err(format!("'{name}' is not a name of an environment (letters, digits, - and _)"));
            }
            let path = p.root.join(ACTIVE_FILE);
            std::fs::create_dir_all(path.parent().expect("in .nuclear")).map_err(|e| e.to_string())?;
            std::fs::write(&path, format!("{name}\n")).map_err(|e| e.to_string())?;
            println!("the active environment of {} is {name}", p.name);
            Ok(())
        }
        ["set", name, rest @ ..] if rest.len() <= 1 => {
            if !valid_name(name) {
                return Err(format!("'{name}' is not a name of a variable (letters, digits and _, not starting with a digit)"));
            }
            let value = match rest.first() {
                Some(v) => v.to_string(),
                None => stdin_value()?,
            };
            if secret {
                let environment = environment.unwrap_or_else(|| chosen(p.root, DEFAULT));
                set_secret(p, &environment, name, &value)
            } else {
                let file = file_of(environment.as_deref(), local);
                set_in_file(&p.root.join(&file), name, &value)?;
                // a plain value of an environment replaces its secret
                if let Some(e) = environment.as_deref()
                    && secrets(p.root).get(e).is_some_and(|s| s.get(*name).is_some_and(|w| w == "keyring"))
                {
                    unset_secret(p, e, name)?;
                }
                println!("{name} set in {file}");
                Ok(())
            }
        }
        ["unset", name] => {
            if secret {
                let environment = environment.unwrap_or_else(|| chosen(p.root, DEFAULT));
                return unset_secret(p, &environment, name);
            }
            let file = file_of(environment.as_deref(), local);
            if unset_in_file(&p.root.join(&file), name)? {
                println!("{name} removed from {file}");
            } else {
                println!("{name} is not in {file}");
            }
            Ok(())
        }
        _ => Err(USAGE.into()),
    }
}

fn take_flag(args: &mut Vec<String>, flag: &str) -> bool {
    let before = args.len();
    args.retain(|a| a != flag);
    args.len() != before
}

fn take_value(args: &mut Vec<String>, flag: &str) -> Result<Option<String>, String> {
    let Some(i) = args.iter().position(|a| a == flag) else { return Ok(None) };
    args.remove(i);
    if i < args.len() { Ok(Some(args.remove(i))) } else { Err(format!("{flag} needs a value")) }
}

fn file_of(environment: Option<&str>, local: bool) -> String {
    match (environment, local) {
        (None, false) => ".env".into(),
        (None, true) => ".env.local".into(),
        (Some(e), false) => format!(".env.{e}"),
        (Some(e), true) => format!(".env.{e}.local"),
    }
}

/// A value from stdin (the editor and the MCP server send secrets this way): all of it, without the last newline.
fn stdin_value() -> Result<String, String> {
    use std::io::{IsTerminal, Read};
    if std::io::stdin().is_terminal() {
        eprintln!("the value (it is not shown), then Enter and Ctrl+D:");
    }
    let mut v = String::new();
    std::io::stdin().read_to_string(&mut v).map_err(|e| format!("cannot read the value from stdin: {e}"))?;
    let v = v.strip_suffix('\n').map(|v| v.strip_suffix('\r').unwrap_or(v)).unwrap_or(&v).to_string();
    Ok(v)
}

fn set_secret(p: &Project, environment: &str, name: &str, value: &str) -> Result<(), String> {
    let mut all = secrets(p.root);
    let local = format!(".env.{environment}.local");
    let stored = account(p.root, &p.name, environment, name, true).and_then(|a| keyring_entry(&a)).and_then(|e| e.set_password(value).map_err(|e| e.to_string()));
    let place = match stored {
        Ok(()) => {
            // the keyring has it now: a copy in the fallback file would outlive it
            let _ = unset_in_file(&p.root.join(&local), name);
            println!("{name} of {environment} stored in the system's keyring (a secret: never printed)");
            "keyring".to_string()
        }
        Err(e) => {
            set_in_file(&p.root.join(&local), name, value)?;
            println!(
                "{name} of {environment}: this system has no keyring ({e}); stored in {local} instead (ignored by git: keep it out of the repository)"
            );
            local
        }
    };
    all.entry(environment.to_string()).or_default().insert(name.to_string(), place);
    write_secrets(p.root, &all)
}

fn unset_secret(p: &Project, environment: &str, name: &str) -> Result<(), String> {
    let mut all = secrets(p.root);
    let Some(place) = all.get_mut(environment).and_then(|s| s.remove(name)) else {
        println!("{name} is not a secret of {environment}");
        return Ok(());
    };
    if place == "keyring" {
        if let Err(e) = account(p.root, &p.name, environment, name, false).and_then(|a| keyring_entry(&a)).and_then(|e| e.delete_credential().map_err(|e| e.to_string())) {
            eprintln!("warning: the keyring did not remove {name} ({e})");
        }
    } else {
        unset_in_file(&p.root.join(&place), name)?;
    }
    all.retain(|_, s| !s.is_empty());
    write_secrets(p.root, &all)?;
    println!("the secret {name} of {environment} removed");
    Ok(())
}

/// `nuclear env list --json` (spec 021 design): every variable × every environment (`environment` alone: that one).
pub fn list(p: &Project, environment: Option<&str>) -> Result<Value, String> {
    let active = chosen(p.root, DEFAULT);
    let envs = match environment {
        Some(e) => vec![e.to_string()],
        None => environments(p.root),
    };
    let mut values: BTreeMap<String, BTreeMap<String, Resolved>> = BTreeMap::new();
    for e in &envs {
        values.insert(e.clone(), resolve(p.root, &p.name, e, false)?);
    }
    // the code's variables first (in its order), then those only the files have
    let mut names: Vec<String> = p.declared.iter().filter_map(|v| v["name"].as_str().map(String::from)).collect();
    let mut from_files: Vec<String> =
        values.values().flat_map(|m| m.keys().cloned()).filter(|n| !names.contains(n)).collect();
    from_files.sort();
    from_files.dedup();
    names.extend(from_files);
    // the shared `.env` alone: the editor's column for what every environment starts from
    let shared: BTreeMap<String, String> = std::fs::read_to_string(p.root.join(".env"))
        .ok()
        .and_then(|t| parse(&t, &|n| std::env::var(n).ok()).ok())
        .map(|pairs| pairs.into_iter().collect())
        .unwrap_or_default();
    let variables: Vec<Value> = names
        .iter()
        .map(|name| {
            let decl = p.declared.iter().find(|v| v["name"] == name.as_str());
            let mut per = serde_json::Map::new();
            for e in &envs {
                let process = std::env::var(name).ok();
                let v = match (values[e].get(name), process, decl.and_then(|d| d["default"].as_str())) {
                    (Some(r), _, _) if r.secret => json!({ "secret": true, "source": r.source }),
                    (_, Some(_), _) => json!({ "value": std::env::var(name).unwrap_or_default(), "source": "process" }),
                    (Some(r), _, _) => json!({ "value": r.value, "source": r.source }),
                    (None, None, Some(d)) => json!({ "value": d, "source": "default" }),
                    (None, None, None) => Value::Null,
                };
                per.insert(e.clone(), v);
            }
            let mut v = json!({
                "name": name,
                "declared": decl.is_some(),
                "required": decl.is_some_and(|d| d["required"] == true),
                "client": decl.is_some_and(|d| d["client"] == true),
                "uses": decl.map_or(json!([]), |d| d["uses"].clone()),
                "values": per,
                "shared": shared.get(name).map_or(Value::Null, |v| json!({ "value": v, "source": ".env" })),
            });
            if let Some(d) = decl.and_then(|d| d.get("default")) {
                v["default"] = d.clone();
            }
            v
        })
        .collect();
    Ok(json!({ "project": p.name, "active": active, "environments": envs, "variables": variables }))
}

/// `nuclear env list` for a person: one environment per column, a secret as `(secret)`, a missing required one as
/// `MISSING`.
fn list_text(out: &Value) -> String {
    let envs: Vec<&str> = out["environments"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
    let mut s = format!("{}: environments {} (active: {})\n", out["project"].as_str().unwrap_or(""), envs.join(", "), out["active"].as_str().unwrap_or(""));
    for v in out["variables"].as_array().into_iter().flatten() {
        let mut tags = Vec::new();
        if v["required"] == true {
            tags.push("required");
        }
        if v["client"] == true {
            tags.push("client");
        }
        if v["declared"] == false {
            tags.push("no code reads it");
        }
        s.push_str(&format!("\n{}{}\n", v["name"].as_str().unwrap_or(""), if tags.is_empty() { String::new() } else { format!("  [{}]", tags.join(", ")) }));
        for e in &envs {
            let x = &v["values"][*e];
            let shown = if x.is_null() {
                if v["required"] == true { "MISSING".to_string() } else { "-".to_string() }
            } else if x["secret"] == true {
                format!("(secret, {})", x["source"].as_str().unwrap_or(""))
            } else {
                format!("{}  ({})", x["value"].as_str().unwrap_or(""), x["source"].as_str().unwrap_or(""))
            };
            s.push_str(&format!("  {e:<14} {shown}\n"));
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn none(_: &str) -> Option<String> {
        None
    }

    fn tmp(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("nuclear-env-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn two_projects_of_one_name_never_share_a_keyring_account() {
        let (a, b) = (tmp("key-a"), tmp("key-b"));
        assert!(account(&a, "todos", "production", "TOKEN", false).is_err(), "no key before the first secret");
        let first = account(&a, "todos", "production", "TOKEN", true).unwrap();
        assert_eq!(account(&a, "todos", "production", "TOKEN", false).unwrap(), first, "the key is kept");
        assert_ne!(account(&b, "todos", "production", "TOKEN", true).unwrap(), first);
        assert!(first.starts_with("todos-") && first.ends_with("/production/TOKEN"));
    }

    #[test]
    fn parses_the_dotenv_format() {
        let text = "# a comment\n\nA=plain value # a comment\nexport B = 'single ${A} \\n'\nC=\"line\\none \\\"q\\\" \\\\ \\$HOME\"\nD=\"two\nlines\"\nE=${A}-x\nF=\"${MISSING:-fallback}\"\nG=\nH=a#b\n";
        let got = parse(text, &none).unwrap();
        let want = [
            ("A", "plain value"),
            ("B", "single ${A} \\n"),
            ("C", "line\none \"q\" \\ $HOME"),
            ("D", "two\nlines"),
            ("E", "plain value-x"),
            ("F", "fallback"),
            ("G", ""),
            ("H", "a#b"),
        ];
        assert_eq!(got, want.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect::<Vec<_>>());
    }

    #[test]
    fn expands_from_the_lookup_and_reports_bad_lines() {
        let got = parse("URL=http://${HOST}/api\n", &|n| (n == "HOST").then(|| "h:1".to_string())).unwrap();
        assert_eq!(got, vec![("URL".to_string(), "http://h:1/api".to_string())]);
        assert!(parse("NO_EQUALS\n", &none).unwrap_err().contains("line 1"));
        assert!(parse("A=1\nB=\"open\n", &none).unwrap_err().contains("line 2"));
        assert!(parse("A='x' tail\n", &none).unwrap_err().contains("unexpected text"));
    }

    #[test]
    fn quoted_values_read_back_the_same() {
        for v in ["plain", "with space", "q\"uote", "back\\slash", "two\nlines", "$HOME ${X}", ""] {
            let text = format!("A={}\n", quoted(v));
            assert_eq!(parse(&text, &none).unwrap(), vec![("A".to_string(), v.to_string())], "{text}");
        }
    }

    #[test]
    fn files_follow_the_precedence() {
        let root = tmp("precedence");
        std::fs::write(root.join(".env"), "A=base\nB=base\nC=base\nD=base\nE=base\n").unwrap();
        std::fs::write(root.join(".env.staging"), "B=staging\nC=staging\nD=staging\n").unwrap();
        std::fs::write(root.join(".env.local"), "C=local\nD=local\n").unwrap();
        std::fs::write(root.join(".env.staging.local"), "D=staging-local\nREF=${B}\n").unwrap();
        std::fs::write(root.join(".env.test"), "B=test\n").unwrap();
        let r = resolve(&root, "p", "staging", false).unwrap();
        let v = |n: &str| r[n].value.clone();
        assert_eq!((v("A"), v("B"), v("C"), v("D"), v("REF")), ("base".into(), "staging".into(), "local".into(), "staging-local".into(), "staging".into()));
        assert_eq!(r["D"].source, ".env.staging.local");
        // .env.local is never read in test
        let t = resolve(&root, "p", "test", false).unwrap();
        assert_eq!((t["B"].value.as_str(), t["C"].value.as_str()), ("test", "base"));
        assert_eq!(environments(&root), vec!["development", "staging", "test"]);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn set_and_unset_keep_the_rest_of_the_file() {
        let root = tmp("set");
        let f = root.join(".env");
        std::fs::write(&f, "# keep me\nA=1\nB=\"two\nlines\"\nC=3\n").unwrap();
        set_in_file(&f, "B", "new value").unwrap();
        set_in_file(&f, "D", "4").unwrap();
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "# keep me\nA=1\nB=\"new value\"\nC=3\nD=4\n");
        assert!(unset_in_file(&f, "A").unwrap());
        assert!(!unset_in_file(&f, "A").unwrap());
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "# keep me\nB=\"new value\"\nC=3\nD=4\n");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn a_secret_without_a_keyring_goes_to_the_local_file_and_is_never_listed() {
        // SAFETY: the only test of this crate that reads NUCLEAR_KEYRING
        unsafe { std::env::set_var("NUCLEAR_KEYRING", "off") };
        let root = tmp("secret");
        let p = Project {
            root: &root,
            name: "p".into(),
            declared: vec![json!({ "name": "TOKEN", "required": true, "client": false, "uses": [] })],
        };
        set_secret(&p, "production", "TOKEN", "s3cret").unwrap();
        assert!(std::fs::read_to_string(root.join(".env.production.local")).unwrap().contains("TOKEN=s3cret"));
        let r = resolve(&root, "p", "production", false).unwrap();
        assert!(r["TOKEN"].secret && r["TOKEN"].value == "s3cret");
        let out = list(&p, None).unwrap();
        let text = out.to_string();
        assert!(!text.contains("s3cret"), "{text}");
        assert_eq!(out["variables"][0]["values"]["production"], json!({ "secret": true, "source": ".env.production.local" }));
        assert_eq!(out["variables"][0]["values"]["development"], Value::Null);
        assert_eq!(out["environments"], json!(["development", "production"]));
        assert_eq!(out["variables"][0]["shared"], Value::Null);
        std::fs::write(root.join(".env"), "TOKEN=dev\n").unwrap();
        assert_eq!(list(&p, None).unwrap()["variables"][0]["shared"], json!({ "value": "dev", "source": ".env" }));
        std::fs::remove_file(root.join(".env")).unwrap();
        // a client that reads it is refused; nothing written into a backend's .env
        let d = diagnose("x = env(\"TOKEN\")\n", &r, true, false, "production");
        assert_eq!(d.iter().map(|d| d.code.id).collect::<Vec<_>>(), vec!["N0311"]);
        write_backend(&root.join("build"), &r, "production").unwrap();
        assert!(!root.join("build/.env").exists());
        unset_secret(&p, "production", "TOKEN").unwrap();
        assert!(!std::fs::read_to_string(root.join(".env.production.local")).unwrap().contains("TOKEN"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_required_variables_name_their_uses() {
        let declared = vec![
            json!({ "name": "TOKEN", "required": true, "uses": [{ "file": "config/project_config.nuc", "line": 5 }] }),
            json!({ "name": "DB", "required": false, "default": "x", "uses": [] }),
        ];
        let m = missing(&declared, &BTreeMap::new());
        assert_eq!(m, vec!["TOKEN (used in config/project_config.nuc:5)".to_string()]);
        assert!(refuse_missing("staging", &m).unwrap_err().contains("--env staging"));
        let d = diagnose("t = env(\"TOKEN\")\nd = env(\"DB\", \"x\")\n", &BTreeMap::new(), false, true, "staging");
        assert_eq!(d.iter().map(|d| d.code.id).collect::<Vec<_>>(), vec!["N0312"]);
    }
}
