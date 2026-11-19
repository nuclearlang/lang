# .claude/hooks

`context-check.sh` keeps each project's documents in step with its code, across sessions and restarts
(`docs/README.md` is the standard; `docs/05-standards/coding.md` says when a change is done). The hooks of
`.claude/settings.json` call it:

| Mode | Hook | What it does |
|---|---|---|
| `session` | `SessionStart` | lists the projects whose code differs from the last commit while none of their documents (their `AGENTS.md` or a file of their `docs/`) does: work of another session that was not recorded |
| `session` | `SessionStart` | lists the context documents over 250 lines: one is read in one go, or it is split (references, guides and plans are not counted) |
| `stop` | `Stop` | if the session changed a project's code and none of that project's documents, it does not let the turn end (once per turn) and names the project |
| `stop` | `Stop` | if the session changed anything the knowledge base is made from, it runs `nuclear-graph knowledge check` and does not let the turn end while the base is behind the tree: build, review the rows it names, ingest |

A project is a folder with an `AGENTS.md`; a file belongs to the closest one above it. Code is sources, data of the
dialects, scripts and manifests; generated folders, type definitions and every file git ignores (a build's output, the
website's content) are not counted.

It compares contents through git (`git diff HEAD`, the new files git does not ignore, `git hash-object`), never file
dates: a checkout, a restore or a reboot changes dates, not work. At its start a session keeps a snapshot of what
already differed from the last commit, with the hash of each file, in `$XDG_RUNTIME_DIR` (`nuclear-context-<session_id>`;
a resumed or compacted session keeps the first one), so `stop` only looks at the files whose contents this session
changed. Contents cannot say which came first, so a document changed earlier in the session counts for code changed
after it.

Trying it by hand:

```sh
echo '{"session_id":"t"}' | .claude/hooks/context-check.sh session
echo '{"session_id":"t"}' | .claude/hooks/context-check.sh stop; echo $?   # 2 = a project's documents are behind, or the knowledge base is
```

Left of what the user asked on 2026-11-11: holding a project's `CHANGELOG.md`, the agents' skill and briefs, and
the website's content to a change (`docs/01-product/roadmap.md`).
