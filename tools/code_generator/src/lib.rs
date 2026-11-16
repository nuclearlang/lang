//! The code generator: what the `nuclear` command writes in a project of the framework.
//!
//! - [`scaffold`]: the smallest file of each kind (`nuclear new`, `nuclear make`), from Rust templates (mobile) or
//!   the platform's `[skeletons]` (backend, web).
//! - [`generate`]: finished code from a resource's data (`nuclear gen`), from the platform's `[[generators]]`.
//!
//! It writes files and reports what it wrote; printing is the command's.

pub mod generate;
pub mod scaffold;
