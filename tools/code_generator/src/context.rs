//! The context documents of a new project (spec 016): `AGENTS.md`, `CLAUDE.md` and `docs/` in layers, written once
//! by `nuclear new` and owned by the user from then on. The templates are data (`context/`); this fills them with what
//! is known of the project (its platform, dialect, layout and commands). What cannot be known is a `TODO(user):` line.

use std::collections::BTreeMap;
use std::path::PathBuf;

use crate::scaffold::Files;

/// The templates, by the path they are written at.
const TEMPLATES: &[(&str, &str)] = &[
    ("AGENTS.md", include_str!("../context/AGENTS.md")),
    ("CLAUDE.md", include_str!("../context/CLAUDE.md")),
    ("docs/README.md", include_str!("../context/docs/README.md")),
    ("docs/00-context/vision.md", include_str!("../context/docs/00-context/vision.md")),
    ("docs/00-context/glossary.md", include_str!("../context/docs/00-context/glossary.md")),
    ("docs/00-context/domain.md", include_str!("../context/docs/00-context/domain.md")),
    ("docs/01-product/prd.md", include_str!("../context/docs/01-product/prd.md")),
    ("docs/01-product/roadmap.md", include_str!("../context/docs/01-product/roadmap.md")),
    ("docs/02-architecture/overview.md", include_str!("../context/docs/02-architecture/overview.md")),
    ("docs/02-architecture/dependencies.md", include_str!("../context/docs/02-architecture/dependencies.md")),
    ("docs/02-architecture/integrations.md", include_str!("../context/docs/02-architecture/integrations.md")),
    ("docs/03-adr/README.md", include_str!("../context/docs/03-adr/README.md")),
    ("docs/03-adr/0000-template.md", include_str!("../context/docs/03-adr/0000-template.md")),
    (
        "docs/03-adr/0001-record-architecture-decisions.md",
        include_str!("../context/docs/03-adr/0001-record-architecture-decisions.md"),
    ),
    ("docs/04-specs/README.md", include_str!("../context/docs/04-specs/README.md")),
    ("docs/04-specs/_template/requirements.md", include_str!("../context/docs/04-specs/_template/requirements.md")),
    ("docs/04-specs/_template/design.md", include_str!("../context/docs/04-specs/_template/design.md")),
    ("docs/04-specs/_template/tasks.md", include_str!("../context/docs/04-specs/_template/tasks.md")),
    ("docs/05-standards/coding.md", include_str!("../context/docs/05-standards/coding.md")),
    ("docs/05-standards/testing.md", include_str!("../context/docs/05-standards/testing.md")),
    ("docs/05-standards/security.md", include_str!("../context/docs/05-standards/security.md")),
    ("docs/06-runbooks/deploy.md", include_str!("../context/docs/06-runbooks/deploy.md")),
    ("docs/06-runbooks/incidents.md", include_str!("../context/docs/06-runbooks/incidents.md")),
];

/// The section of `docs/README.md` that says what the documents never hold (spec 025: Nuclear is the MCP server's,
/// the oracle; the architecture is the project's), between its markers: `nuclear agent init` refreshes it in a
/// project made before it, the same text `nuclear new` writes.
pub fn oracle_section() -> &'static str {
    let readme = TEMPLATES.iter().find(|(p, _)| *p == "docs/README.md").map(|(_, t)| *t).unwrap_or_default();
    let (start, end) = ("<!-- nuclearlang -->", "<!-- /nuclearlang -->");
    match (readme.find(start), readme.find(end)) {
        (Some(a), Some(b)) if a < b => &readme[a..b + end.len()],
        _ => "",
    }
}

/// What is known of a new project.
pub struct Project<'a> {
    pub name: &'a str,
    pub platform: &'a str,
    pub dialect: &'a str,
    /// The dialect's chain, e.g. `flutter → dart`.
    pub stack: &'a str,
    /// The platform's `[layout]`: kind → path.
    pub layout: &'a BTreeMap<String, String>,
    /// `YYYY-MM-DD`.
    pub date: &'a str,
}

/// The files of the context documents, filled.
pub fn documents(p: &Project) -> Files {
    let commands = commands(p.platform);
    let test = commands.iter().find(|(what, _)| *what == "Tests").map(|(_, c)| format!("- `{c}`")).unwrap_or_default();
    let commands: Vec<String> = commands.iter().map(|(what, c)| format!("- {what}: `{c}`")).collect();
    let layout: Vec<String> = std::iter::once("| Kind | File |\n|---|---|".to_string())
        .chain(p.layout.iter().map(|(kind, path)| format!("| `{kind}` | `{path}` |")))
        .collect();
    let values = [
        ("name", p.name.to_string()),
        ("platform", p.platform.to_string()),
        ("dialect", p.dialect.to_string()),
        ("stack", p.stack.to_string()),
        ("date", p.date.to_string()),
        ("commands", commands.join("\n")),
        ("test", test),
        ("folders", folders(p.platform, p.layout).join("\n")),
        ("layout", layout.join("\n")),
    ];
    TEMPLATES
        .iter()
        .map(|(path, text)| {
            let filled = values.iter().fold(text.to_string(), |t, (k, v)| t.replace(&format!("{{{{{k}}}}}"), v));
            (PathBuf::from(path), filled)
        })
        .collect()
}

/// The `nuclear` commands of a project of the platform, by what they are for.
fn commands(platform: &str) -> Vec<(&'static str, &'static str)> {
    let mut out = vec![("Check (after every change)", "nuclear check --json"), ("Format", "nuclear fmt .")];
    if platform == "mobile" {
        out.extend([
            ("Build", "nuclear build"),
            ("Run", "nuclear run"),
            ("A device in its own window", "nuclear device"),
            ("Tests", "nuclear test"),
            ("Analyze the generated app", "nuclear analyze"),
        ]);
    } else {
        out.extend([("Build", "nuclear build"), ("Install", "nuclear install"), ("Run", "nuclear run"), ("Tests", "nuclear test")]);
    }
    out.push(("Every command of the project", "nuclear help"));
    out
}

/// The project's top folders: the manifest, the first folder of each layout path, and `build/`.
fn folders(platform: &str, layout: &BTreeMap<String, String>) -> Vec<String> {
    let mut out = vec!["- `config.nuc`: the project's manifest: its platform, dialect, name and libraries.".to_string()];
    if platform != "backend" {
        out.push("- `main.nuc`: the app's entry.".into());
    }
    let mut tops: Vec<&str> = layout.values().filter_map(|p| p.split('/').next()).filter(|t| !t.ends_with(".nuc")).collect();
    tops.sort();
    tops.dedup();
    for top in tops {
        let what = match top {
            "components" => "the components: each with its facade, its domain (use cases, models), its data and its views",
            "shared" => "what every component uses (widgets, events, guards...)",
            "config" => "the app's connections and services",
            "test" => "the tests, written in Nuclear",
            "integration_test" => "the integration tests, on a device",
            _ => "pieces of the platform",
        };
        out.push(format!("- `{top}/`: {what}."));
    }
    out.push("- `build/`: the generated project: never edited, rebuilt from the `.nuc` files.".into());
    out
}

/// Today in UTC as `YYYY-MM-DD`.
pub fn today() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let (y, m, d) = civil(secs as i64 / 86_400);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Days since 1970-01-01 → (year, month, day): Howard Hinnant's `civil_from_days`.
fn civil(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Spec 025: the README's section that sends Nuclear to the oracle and keeps the architecture, whole between its
    /// markers, what `nuclear agent init` refreshes.
    #[test]
    fn the_oracle_section_is_the_readmes_between_its_markers() {
        let s = oracle_section();
        assert!(s.starts_with("<!-- nuclearlang -->") && s.ends_with("<!-- /nuclearlang -->"), "{s}");
        assert!(s.contains("MCP server") && s.contains("its architecture") && s.contains("project_inspect"), "{s}");
    }

    #[test]
    fn civil_dates() {
        assert_eq!(civil(0), (1970, 1, 1));
        assert_eq!(civil(11_016), (2000, 2, 29));
        assert_eq!(civil(20_775), (2026, 11, 18));
    }

    #[test]
    fn every_template_is_filled_and_short() {
        let layout: BTreeMap<String, String> =
            [("usecase", "components/{component}/domain/usecases/{file}.nuc"), ("tests", "test/{file}.nuc")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect();
        let p = Project { name: "shop", platform: "mobile", dialect: "flutter", stack: "flutter → dart", layout: &layout, date: "2026-11-18" };
        let docs = documents(&p);
        assert_eq!(docs.len(), TEMPLATES.len());
        for (path, text) in &docs {
            assert!(!text.contains("{{"), "{} has a placeholder left", path.display());
            assert!(text.lines().count() < 150, "{} is long", path.display());
        }
        let agents = &docs.iter().find(|(p, _)| p == &PathBuf::from("AGENTS.md")).unwrap().1;
        assert!(agents.starts_with("# shop") && agents.contains("`nuclear check --json`") && agents.contains("`components/`"));
        let overview = &docs.iter().find(|(p, _)| p.ends_with("overview.md")).unwrap().1;
        assert!(overview.contains("| `usecase` | `components/{component}/domain/usecases/{file}.nuc` |"));
    }
}
