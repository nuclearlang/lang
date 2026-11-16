//! NuclearLang dialects: data files that teach the transpiler a target language or framework.
//!
//! - [`template`]: the template engine used by every dialect file.
//! - [`contract`]: the list of templates, variables and options a dialect can define.
//! - [`model`]: loading `dialects/<name>/*.toml`, inheritance (`extends`) and validation.
//! - [`defs`]: type definitions packages (the public API of the target's libraries, like `.d.ts`).

pub mod contract;
pub mod defs;
pub mod library;
pub mod model;
pub mod template;

pub use model::{Dialect, Loader, Report};

/// Editor documentation of a word of the base language (`base/docs.toml`): `section` is `keywords`,
/// `builtins` (`Result`, `Ok`, `Err`), `types` (`int`, `string`...) or `tags` (`@param`...).
pub fn base_doc(section: &str, name: &str) -> Option<&'static str> {
    static DOCS: std::sync::OnceLock<toml::Table> = std::sync::OnceLock::new();
    let docs = DOCS.get_or_init(|| include_str!("../../../base/docs.toml").parse().expect("base/docs.toml"));
    docs.get(section)?.get(name)?.as_str().map(str::trim)
}

use std::path::{Path, PathBuf};

/// Where an installed NuclearLang keeps its files (`dialects/`, `platforms/`, `kinds/`, `tools/`):
/// `$NUCLEAR_HOME`, or the folder above the binary's `bin/` (see `installer/install.sh`). `None` outside an install.
pub fn install_dir() -> Option<PathBuf> {
    let dir = match std::env::var_os("NUCLEAR_HOME") {
        Some(home) => PathBuf::from(home),
        None => std::env::current_exe().ok()?.canonicalize().ok()?.parent()?.parent()?.to_path_buf(),
    };
    dir.join("dialects").is_dir().then_some(dir)
}

/// Where NuclearLang's files are: an install, or the source tree this crate was built in. Both have the same shape.
#[derive(Debug, Clone)]
pub struct Home {
    /// `<language>/`, each with its dialect files, `frameworks/<dialect>/`, `defs/` and `docs/`.
    pub dialects: PathBuf,
    /// `<platform>/`, each with its `platform.toml`, `packages/`, `examples/` and `docs/`.
    pub platforms: PathBuf,
    /// The folder of the framework's own `docs/`.
    pub framework: PathBuf,
}

impl Home {
    /// The source tree: `nuclearlang/dialects` and `nuclear-synapsis-framework/platforms`.
    pub fn tree() -> Home {
        let root = Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/../../.."));
        let framework = root.join("nuclear-synapsis-framework");
        Home { dialects: root.join("nuclearlang/dialects"), platforms: framework.join("platforms"), framework }
    }

    /// An install: `dialects/` and `platforms/` next to each other.
    pub fn install() -> Option<Home> {
        let dir = install_dir()?;
        Some(Home { dialects: dir.join("dialects"), platforms: dir.join("platforms"), framework: dir })
    }

    /// Every folder that may hold a `docs/` or an `examples/`: the framework's, each language's, each platform's.
    pub fn roots(&self) -> Vec<PathBuf> {
        let mut inner: Vec<PathBuf> = [&self.dialects, &self.platforms]
            .into_iter()
            .flat_map(|d| std::fs::read_dir(d).into_iter().flatten().flatten())
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect();
        inner.sort();
        std::iter::once(self.framework.clone()).chain(inner).collect()
    }
}

/// The homes a tool reads, in priority order: the install, then the source tree while it is on disk.
pub fn homes() -> Vec<Home> {
    Home::install().into_iter().chain(Some(Home::tree()).filter(|h| h.dialects.is_dir())).collect()
}

/// The definitions generated for the packages a project adds (`dragonfly flutter add hive`), shared by every
/// project: `$XDG_CACHE_HOME/nuclearlang/defs`, or `~/.cache/nuclearlang/defs`, as `<language>/<package>/<version>/`.
pub fn defs_cache_dir() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".cache")))?;
    Some(base.join("nuclearlang").join("defs"))
}
