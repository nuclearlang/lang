//! The packages a backend or web project adds (ADR-lang-0008): `nuclear add <package>` installs one with the dialect's
//! package manager, writes it in config.nuc and generates its type definitions into the project's `defs/`, so the
//! compiler, the language server and the dialect know its names. Every command is the dialect's (`[toolchain]
//! package_*`): nothing here knows npm or pip.

use super::{backend_command, fill_command, landing, packages, shell, shell_output, shell_quote, take_option};
use nuclear_dialect::Dialect;
use nuclear_transpile::project::{self, Manifest};
use std::path::{Path, PathBuf};

const ADD: &str = "usage: nuclear add <package>[@version]... [--module <module>]...";
const REMOVE: &str = "usage: nuclear remove <package>...";
const SECTION: &str = project::DEPENDENCIES_SECTION;

/// `nuclear add <package>[@version]... [--module <module>]...`: each package is installed in the generated project,
/// written in `dependencies(...)` with the version the package manager resolved, and described in `defs/`. The
/// package that carries its types (`@types/lodash`) comes with it. `--module` names the modules to describe when
/// they are not the package's own (`sklearn.linear_model`).
pub fn add(root: &Path, m: &Manifest, d: &Dialect, args: &[String]) -> Result<(), String> {
    let mut args = args.to_vec();
    let mut modules = Vec::new();
    while let Some(module) = take_option(&mut args, "--module") {
        modules.push(module);
    }
    if args.is_empty() || args.iter().any(|a| a.starts_with("--")) {
        return Err(ADD.into());
    }
    for key in ["package_add", "package_version", "package_defs"] {
        tool(d, key)?;
    }
    let names: Vec<&str> = args.iter().map(|a| spec(a).0).collect();
    let reserved: Vec<&str> = names.iter().copied().filter(|n| project::reserved_package(d, n)).collect();
    if !reserved.is_empty() {
        return Err(format!(
            "{} already part of Synapsis (the {} dialect uses it): use it directly, without adding it.",
            reserved.join(", "),
            d.name
        ));
    }
    let out = installed(root, m, d)?;
    let config = root.join(packages::CONFIG);
    let mut text = std::fs::read_to_string(&config).map_err(|e| format!("{}: {e}", config.display()))?;
    for arg in &args {
        let (name, wanted) = spec(arg);
        if let Some(note) = d.project.manifest.as_ref().and_then(|x| x.advice.get(name)) {
            eprintln!("{} {}: {note}. It is added all the same.", landing::dim("·"), landing::name(name));
        }
        text = packages::set_entry(&text, SECTION, name, &install(d, &out, name, wanted)?)?;
        if let Some(other) = companion(d, &out, name)? {
            match install(d, &out, &other, None) {
                Ok(constraint) => text = packages::set_entry(&text, SECTION, &other, &constraint)?,
                Err(_) => eprintln!("{} {name} has no types of its own and {other} could not be installed", landing::bad("!")),
            }
        }
        // written after each package: one that fails later leaves the ones before it in place
        std::fs::write(&config, &text).map_err(|e| e.to_string())?;
        generate(root, d, &out, name, &modules)?;
    }
    Ok(())
}

/// `nuclear remove <package>...`: out of config.nuc, of the generated project and of `defs/`, with the package
/// that carried its types.
pub fn remove(root: &Path, m: &Manifest, d: &Dialect, args: &[String]) -> Result<(), String> {
    if args.is_empty() || args.iter().any(|a| a.starts_with("--")) {
        return Err(REMOVE.into());
    }
    let out = root.join(project::output_dir(m, d));
    let is_installed = d.tool("installed").is_some_and(|i| out.join(i).exists());
    let config = root.join(packages::CONFIG);
    let mut text = std::fs::read_to_string(&config).map_err(|e| format!("{}: {e}", config.display()))?;
    for name in args {
        let mut gone = vec![name.clone()];
        if is_installed {
            gone.extend(companion(d, &out, name).ok().flatten());
        }
        for package in &gone {
            text = packages::remove_entry(&text, SECTION, package)?;
            if let (true, Some(command)) = (is_installed, d.tool("package_remove")) {
                shell(&out, &fill_command(d, command, &[("name", package.clone())])?)?;
            }
        }
        let _ = std::fs::remove_dir_all(defs_dir(root, d, name));
    }
    std::fs::write(&config, text).map_err(|e| e.to_string())
}

/// After `nuclear install`: the definitions of every package of `dependencies(...)` that has none yet (one written
/// by hand in config.nuc, a project just cloned without its `defs/`). A folder on disk brings its own; the package
/// that only carries another's types has none. One that cannot be described is said, and the install stands.
pub fn ensure_defs(root: &Path, m: &Manifest, d: &Dialect) -> Result<(), String> {
    if d.tool("package_defs").is_none() || d.tool("package_version").is_none() {
        return Ok(());
    }
    let out = root.join(project::output_dir(m, d));
    let own: Vec<&String> =
        m.dependencies.iter().filter(|(_, v)| !v.starts_with('.') && !v.starts_with('/')).map(|(n, _)| n).collect();
    let companions: Vec<String> = own.iter().filter_map(|n| companion(d, &out, n).ok().flatten()).collect();
    for name in own {
        if companions.contains(name) || has_defs(&defs_dir(root, d, name)) {
            continue;
        }
        if let Err(e) = generate(root, d, &out, name, &[]) {
            eprintln!("{} type definitions of {name}: {e}", landing::bad("!"));
        }
    }
    Ok(())
}

/// `<package>[@version]` of the command line: the version follows the first `@` that is not the first character.
fn spec(arg: &str) -> (&str, Option<&str>) {
    match project::split_entry(arg) {
        Some((name, version)) => (name, Some(version)),
        None => (arg, None),
    }
}

fn tool<'a>(d: &'a Dialect, key: &str) -> Result<&'a str, String> {
    d.tool(key).ok_or(format!("the {} dialect cannot add packages (it has no toolchain.{key})", d.name))
}

/// The generated project with its packages installed: where the package manager works.
fn installed(root: &Path, m: &Manifest, d: &Dialect) -> Result<PathBuf, String> {
    let out = root.join(project::output_dir(m, d));
    if !d.tool("installed").is_some_and(|i| out.join(i).exists()) {
        backend_command(root, "install", m, &[], &[])?;
    }
    Ok(out)
}

/// Installs one package and gives what config.nuc writes as its version: the one asked for, or the dialect's
/// constraint over the version the package manager resolved. A version written bare (`4.17.0`) is exact where the
/// package manager needs that said (`package_exact`).
fn install(d: &Dialect, out: &Path, name: &str, wanted: Option<&str>) -> Result<String, String> {
    let wanted = wanted.map(|v| match v.starts_with(|c: char| c.is_ascii_digit()) {
        true => format!("{}{v}", d.tool("package_exact").unwrap_or_default()),
        false => v.to_string(),
    });
    let requirement = match &wanted {
        Some(v) => d.tool("package_requirement").unwrap_or("{{name}}@{{version}}").replace("{{name}}", name).replace("{{version}}", v),
        None => name.to_string(),
    };
    shell(out, &fill_command(d, tool(d, "package_add")?, &[("requirement", requirement)])?)?;
    match wanted {
        Some(v) => Ok(v),
        None => Ok(d.tool("package_constraint").unwrap_or("{{version}}").replace("{{version}}", &version(d, out, name)?)),
    }
}

/// The version of a package as the generated project has it installed.
fn version(d: &Dialect, out: &Path, name: &str) -> Result<String, String> {
    let found = shell_output(out, &fill_command(d, tool(d, "package_version")?, &[("name", name.to_string())])?)?;
    let found = found.trim();
    if found.is_empty() { Err(format!("'{name}' is not installed in {}", out.display())) } else { Ok(found.to_string()) }
}

/// The package that carries the types of `name`, when it is another one (`[toolchain] package_companion`).
fn companion(d: &Dialect, out: &Path, name: &str) -> Result<Option<String>, String> {
    let Some(command) = d.tool("package_companion") else { return Ok(None) };
    let other = shell_output(out, &fill_command(d, command, &[("name", name.to_string())])?)?;
    Ok(Some(other.trim().to_string()).filter(|o| !o.is_empty()))
}

/// Writes the definitions of an installed package into `defs/<language>/<name>/<version>/`, in place of the ones of
/// another version.
fn generate(root: &Path, d: &Dialect, out: &Path, name: &str, modules: &[String]) -> Result<(), String> {
    let installed = version(d, out, name)?;
    let dir = defs_dir(root, d, name);
    let _ = std::fs::remove_dir_all(&dir);
    // the definitions of the language itself (`python@3.14`): what the package's types are written with
    let language = d.chain.last().cloned().unwrap_or_default();
    let depends = d.typedefs.package(&language).map(|p| p.id()).unwrap_or_default();
    let words: Vec<String> = modules.iter().map(|m| shell_quote(m)).collect();
    let command = tool(d, "package_defs")?.replace("{{modules}}", &words.join(" "));
    let vars = [
        ("name", name.to_string()),
        ("defs_name", defs_name(name)),
        ("version", installed),
        ("defs", root.join(project::PROJECT_DEFS).display().to_string()),
        ("depends", depends),
    ];
    shell(out, &fill_command(d, &command, &vars)?)
}

/// The folder of a package's definitions: `defs/<language>/<name>/`, one folder below it per version.
fn defs_dir(root: &Path, d: &Dialect, name: &str) -> PathBuf {
    root.join(project::PROJECT_DEFS).join(d.chain.last().map(String::as_str).unwrap_or_default()).join(defs_name(name))
}

/// The name of a package's definitions: its own, as one folder (`@nestjs/axios` → `nestjs__axios`).
fn defs_name(name: &str) -> String {
    name.trim_start_matches('@').replace('/', "__")
}

fn has_defs(dir: &Path) -> bool {
    std::fs::read_dir(dir).into_iter().flatten().flatten().any(|v| v.path().join("package.toml").is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_spec_splits_at_the_version() {
        assert_eq!(spec("lodash"), ("lodash", None));
        assert_eq!(spec("lodash@^4.17.21"), ("lodash", Some("^4.17.21")));
        assert_eq!(spec("@nestjs/axios"), ("@nestjs/axios", None));
        assert_eq!(spec("@nestjs/axios@4.0.1"), ("@nestjs/axios", Some("4.0.1")));
        assert_eq!(spec("humanize@>=4.9"), ("humanize", Some(">=4.9")));
    }

    #[test]
    fn the_definitions_of_a_scoped_package_are_one_folder() {
        assert_eq!(defs_name("lodash"), "lodash");
        assert_eq!(defs_name("python-slugify"), "python-slugify");
        assert_eq!(defs_name("@nestjs/axios"), "nestjs__axios");
    }
}
