//! `nuclear workspace` end to end, through the binary: a workspace, a backend and a web app, list, rename, remove.

use serde_json::Value;
use std::path::Path;
use std::process::Command;

fn nuclear(dir: &Path, args: &[&str]) -> (bool, Value) {
    let out = Command::new(env!("CARGO_BIN_EXE_nuclear"))
        .args(args)
        .current_dir(dir)
        .env("NUCLEAR_NO_UPDATE_CHECK", "1")
        .env("NO_COLOR", "1")
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&out.stdout);
    let json = serde_json::from_str(&stdout)
        .unwrap_or_else(|e| panic!("{args:?}: stdout is not JSON ({e}): {stdout}\n{}", String::from_utf8_lossy(&out.stderr)));
    (out.status.success(), json)
}

#[test]
fn a_workspace_with_a_backend_and_a_web_app() {
    let dir = std::env::temp_dir().join(format!("nuclear-workspace-e2e-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let (ok, ws) = nuclear(&dir, &["workspace", "new", "citofony", "--description", "An intercom for buildings", "--json"]);
    assert!(ok, "{ws}");
    assert_eq!(ws["name"], "citofony");
    let root = dir.join("citofony");
    assert!(root.join(".workspace/workspace.nuc").is_file());

    let (ok, ws) = nuclear(&root, &["workspace", "add", "citofony_api", "--platform", "backend", "--dialect", "fastapi", "--json"]);
    assert!(ok, "{ws}");
    // `nuclear new` from a folder inside the workspace makes the app in the workspace's folder and registers it
    let made = Command::new(env!("CARGO_BIN_EXE_nuclear"))
        .args(["new", "citofony_web", "-p", "web", "-d", "react"])
        .current_dir(root.join("citofony_api"))
        .env("NUCLEAR_NO_UPDATE_CHECK", "1")
        .output()
        .unwrap();
    assert!(made.status.success(), "{}", String::from_utf8_lossy(&made.stderr));
    assert!(root.join("citofony_web/config.nuc").is_file());

    let (ok, ws) = nuclear(&root.join("citofony_web"), &["workspace", "list", "--json"]);
    assert!(ok);
    let apps: Vec<(&str, &str, &str, bool)> = ws["apps"]
        .as_array()
        .unwrap()
        .iter()
        .map(|a| (a["folder"].as_str().unwrap(), a["platform"].as_str().unwrap(), a["dialect"].as_str().unwrap(), a["exists"] == true))
        .collect();
    assert_eq!(apps, [("citofony_api", "backend", "fastapi", true), ("citofony_web", "web", "react", true)]);

    let w = root.to_str().unwrap();
    let (ok, ws) = nuclear(&dir, &["workspace", "rename", "citofony_web", "citofony_site", "--workspace", w, "--json"]);
    assert!(ok, "{ws}");
    assert_eq!(ws["apps"][1]["folder"], "citofony_site");
    assert!(root.join("citofony_site/config.nuc").is_file());

    let (ok, ws) = nuclear(&root, &["workspace", "remove", "citofony_site", "--delete", "--json"]);
    assert!(ok, "{ws}");
    assert_eq!(ws["apps"].as_array().unwrap().len(), 1);
    assert!(!root.join("citofony_site").exists());

    let (ok, ws) = nuclear(&root, &["workspace", "remove", "nope", "--json"]);
    assert!(!ok && ws["error"].as_str().unwrap().contains("no app 'nope'"));
    let (ok, ws) = nuclear(&dir, &["workspace", "find", "--json"]);
    assert!(ok && ws.is_null());
    let _ = std::fs::remove_dir_all(&dir);
}
