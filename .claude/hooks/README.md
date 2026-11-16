# .claude/hooks

`context-check.sh` keeps each project's documents in step with its code, across sessions and restarts
(`docs/README.md` is the standard; `docs/05-standards/coding.md` says when a change is done). The hooks of
`.claude/settings.json` call it:

| Mode | Hook | What it does |
|---|---|---|
| `session` | `SessionStart` | lists the projects whose code is newer than their documents (their `AGENTS.md` or a file of their `docs/`): work of another session that was not recorded |
| `session` | `SessionStart` | lists the context documents over 250 lines: one is read in one go, or it is split (references, guides and plans are not counted) |
| `stop` | `Stop` | if the session changed a project's code after that project's documents, it does not let the turn end (once per turn) and names the project |
| `stop` | `Stop` | if the session changed anything the knowledge base is made from, it runs `nuclear-graph knowledge check` and does not let the turn end while the base is behind the tree: build, review the rows it names, ingest |

A project is a folder with an `AGENTS.md`; a file belongs to the closest one above it. Code is sources, data of the
dialects, scripts and manifests; generated folders and type definitions are not counted. The session is marked with
a file in `$XDG_RUNTIME_DIR` (`nuclear-context-<session_id>`), so `stop` only looks at what changed since it started.

Trying it by hand:

```sh
echo '{"session_id":"t"}' | .claude/hooks/context-check.sh session
echo '{"session_id":"t"}' | .claude/hooks/context-check.sh stop; echo $?   # 2 = a project's documents are behind, or the knowledge base is
```

Left of what the user asked on 2026-11-11: holding a project's `CHANGELOG.md`, the agents' skill and briefs, and
the website's content to a change (`docs/01-product/roadmap.md`).
