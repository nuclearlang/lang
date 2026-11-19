//! `nuclear monitor` (spec 015): the report an app built with `--monitor` writes, as its hot spots and its call tree.

use serde_json::{Value, json};
use std::path::{Path, PathBuf};

/// Own time of a node, as a share of its root's time, that makes it `slow`.
const SLOW_SHARE: f64 = 0.2;
/// Calls per call of the parent that make an async node a `loop` (awaits in series).
const LOOP_CALLS: f64 = 5.0;
/// Own connections per call that make a node `connections`.
const MANY_CONNECTIONS: f64 = 10.0;
/// Own memory per call (bytes) that makes a node `memory`.
const MUCH_MEMORY: f64 = 10.0 * 1024.0 * 1024.0;

/// The report of the project at `start` or above.
fn find(start: &Path) -> Result<PathBuf, String> {
    let start = start.canonicalize().unwrap_or_else(|_| start.to_path_buf());
    start.ancestors().map(|d| d.join(crate::MONITOR_REPORT)).find(|p| p.is_file()).ok_or_else(|| {
        format!(
            "no {} in {} or above: run the app with `nuclear run --monitor` (or `nuclear build --monitor`) first",
            crate::MONITOR_REPORT,
            start.display()
        )
    })
}

fn num(n: &Value, key: &str) -> f64 {
    n.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}

fn children(n: &Value) -> &[Value] {
    n.get("children").and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[])
}

/// One flagged node: where it is, why, and the labels of its callers.
fn hot_spots(roots: &[Value]) -> Vec<Value> {
    fn walk(n: &Value, parent: Option<&Value>, root_ms: f64, via: &mut Vec<String>, out: &mut Vec<Value>) {
        let label = n["label"].as_str().unwrap_or_default().to_string();
        let calls = num(n, "calls").max(1.0);
        let per_parent = parent.map_or(calls, |p| calls / num(p, "calls").max(1.0));
        let own_connections = num(n, "connections") - children(n).iter().map(|c| num(c, "connections")).sum::<f64>();
        let own_memory = num(n, "memory_bytes") - children(n).iter().map(|c| num(c, "memory_bytes")).sum::<f64>();
        let mut flags = Vec::new();
        if root_ms > 0.0 && num(n, "self_ms") >= SLOW_SHARE * root_ms {
            flags.push("slow");
        }
        // in series: the calls together take no more than the parent (concurrent ones would add up past it)
        let serial = parent.is_none_or(|p| num(n, "total_ms") <= num(p, "total_ms") * 1.05);
        if n["async"].as_bool() == Some(true) && per_parent >= LOOP_CALLS && serial {
            flags.push("loop");
        }
        if own_connections / calls >= MANY_CONNECTIONS {
            flags.push("connections");
        }
        if own_memory / calls >= MUCH_MEMORY {
            flags.push("memory");
        }
        if !flags.is_empty() {
            out.push(json!({
                "label": label, "path": n["path"], "line": n["line"], "flags": flags, "self_ms": n["self_ms"],
                "total_ms": n["total_ms"], "calls": n["calls"], "calls_per_parent_call": (per_parent * 10.0).round() / 10.0,
                "connections": n["connections"], "memory_bytes": n["memory_bytes"], "via": via.join(" › "),
            }));
        }
        via.push(label);
        for c in children(n) {
            walk(c, Some(n), root_ms, via, out);
        }
        via.pop();
    }
    let mut out = Vec::new();
    for r in roots {
        walk(r, None, num(r, "total_ms"), &mut Vec::new(), &mut out);
    }
    out.sort_by(|a, b| num(b, "self_ms").total_cmp(&num(a, "self_ms")));
    out
}

fn ms(v: f64) -> String {
    if v >= 100.0 { format!("{v:.0} ms") } else { format!("{v:.1} ms") }
}

fn bytes(v: f64) -> String {
    if v >= 1024.0 * 1024.0 { format!("{:.1} MB", v / 1024.0 / 1024.0) } else { format!("{:.0} KB", v / 1024.0) }
}

/// The tree as text, a line per node: time, own time, calls, connections, memory.
fn tree(n: &Value, depth: usize, out: &mut String) {
    let mut line = format!(
        "{}{}  {}  (own {})  ×{}",
        "  ".repeat(depth),
        n["label"].as_str().unwrap_or_default(),
        ms(num(n, "total_ms")),
        ms(num(n, "self_ms")),
        num(n, "calls")
    );
    if num(n, "connections") > 0.0 {
        line.push_str(&format!("  {} connections", num(n, "connections")));
    }
    if num(n, "memory_bytes") >= 1024.0 {
        line.push_str(&format!("  +{}", bytes(num(n, "memory_bytes"))));
    }
    line.push_str(&format!("  {}:{}\n", n["path"].as_str().unwrap_or_default(), n["line"]));
    out.push_str(&line);
    for c in children(n) {
        tree(c, depth + 1, out);
    }
}

/// What `nuclear monitor` prints: the hot spots first, then the tree. `json`: both as one object.
pub fn render(report: &Value, file: &Path, json: bool) -> String {
    let roots = report["roots"].as_array().map(Vec::as_slice).unwrap_or(&[]);
    let spots = hot_spots(roots);
    if json {
        let all = json!({ "report": file.display().to_string(), "app": report["app"], "runtime": report["runtime"],
            "updated": report["updated"], "notes": report["notes"], "hot_spots": spots, "roots": roots });
        return serde_json::to_string_pretty(&all).unwrap_or_default();
    }
    let mut out = format!(
        "Nuclear Monitor · {} ({}) · updated {}\n{}\n",
        report["app"].as_str().unwrap_or_default(),
        report["runtime"].as_str().unwrap_or_default(),
        report["updated"].as_str().unwrap_or_default(),
        file.display()
    );
    for note in report["notes"].as_array().into_iter().flatten() {
        out.push_str(&format!("note: {}\n", note.as_str().unwrap_or_default()));
    }
    out.push_str(&format!("\nhot spots ({}):\n", spots.len()));
    if spots.is_empty() {
        out.push_str("  none: no function stands out\n");
    }
    for s in &spots {
        let flags: Vec<&str> = s["flags"].as_array().into_iter().flatten().filter_map(Value::as_str).collect();
        let mut why = Vec::new();
        for f in &flags {
            why.push(match *f {
                "slow" => format!("own {}", ms(num(s, "self_ms"))),
                "loop" => format!(
                    "{} async calls per call, one after another: run them together",
                    num(s, "calls_per_parent_call")
                ),
                "connections" => format!("{} connections", num(s, "connections")),
                _ => format!("+{}", bytes(num(s, "memory_bytes"))),
            });
        }
        out.push_str(&format!(
            "  [{}] {}  {}:{}  {}{}\n",
            flags.join(", "),
            s["label"].as_str().unwrap_or_default(),
            s["path"].as_str().unwrap_or_default(),
            s["line"],
            why.join("; "),
            s["via"].as_str().filter(|v| !v.is_empty()).map(|v| format!("  (from {v})")).unwrap_or_default()
        ));
    }
    out.push_str("\ncalls:\n");
    for r in roots {
        tree(r, 1, &mut out);
    }
    out
}

/// `nuclear monitor [--json]` in the project at `start`.
pub fn command(start: &Path, json: bool) -> Result<(), String> {
    let file = find(start)?;
    let text = std::fs::read_to_string(&file).map_err(|e| format!("{}: {e}", file.display()))?;
    let report: Value = serde_json::from_str(&text).map_err(|e| format!("{}: {e}", file.display()))?;
    print!("{}", render(&report, &file, json));
    if !json {
        println!();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(label: &str, total: f64, own: f64, calls: u32, is_async: bool, kids: Vec<Value>) -> Value {
        json!({ "label": label, "path": "a.nuc", "line": 1, "async": is_async, "calls": calls, "total_ms": total,
            "self_ms": own, "max_ms": total, "connections": 0, "memory_bytes": 0, "children": kids })
    }

    #[test]
    fn flags_the_slow_call_and_the_awaits_in_series() {
        let send = node("sendChat", 1000.0, 1000.0, 12, true, vec![]);
        let user = node("getUser", 1200.0, 1200.0, 1, true, vec![]);
        let convert = node("convertData", 120.0, 120.0, 1, false, vec![]);
        let exec = node("exec", 2400.0, 80.0, 1, true, vec![user, send, convert]);
        let spots = hot_spots(&[exec]);
        let labels: Vec<&str> = spots.iter().map(|s| s["label"].as_str().unwrap()).collect();
        assert_eq!(labels, ["getUser", "sendChat"]);
        assert_eq!(spots[1]["flags"], json!(["slow", "loop"]));
        assert_eq!(spots[1]["via"], "exec");
        // concurrent calls add up past the parent: not a loop
        let both = node("both", 120.0, 0.0, 1, true, vec![node("getUser", 600.0, 600.0, 5, true, vec![])]);
        let spots = hot_spots(&[both]);
        assert!(spots.iter().all(|s| !s["flags"].as_array().unwrap().contains(&json!("loop"))));
    }
}
