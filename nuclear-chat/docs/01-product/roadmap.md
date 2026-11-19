---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [../02-architecture/overview.md, ../../../docs/04-specs/013-nuclear-chat/tasks.md, ../../../docs/04-specs/014-synapsis-real-time-and-embedded/requirements.md]
---
# Roadmap

## Half done
- **The UI talks to the service** (spec 013 T2.1, [ui.md](../02-architecture/ui.md)): the contract writes `@body`
  and a write reaches the service (a message said through a host's relay answered 201, 2026-11-18). The cost and a thread's last reply
  appear when the service answers Nuclear's field names (the item below). The UI's other shortcuts wait for the
  web platform (a topic with the workspace, the route's query, translations) and the react dialect (models built in
  a view, conditional children): each is `shortcut:` in `ui/` and in those projects' roadmaps.
- **The hosts** (spec 013 phase 3): VS Code's extension hosts the Builder and Atlas
  ([connect-a-host.md](../08-guides/connect-a-host.md), "The hosts of the editors"); the JetBrains window has no
  chat (out of this version). `/poc` reaches the Builder, which cannot run it yet (its roadmap).
- **A remote profile has no chat service**: the set-up starts the services only for a profile with local agents
  (`keepRemote` removes them); a user of remote agents only would start `nuclear-chat serve` by hand.

## Untested
- A member's GIF with a streaming agent: `MemberLines` holds back a `gif:` line being written (tested with pieces);
  only the local agent's whole answers were run end to end. An answer that is only a `gif:` line posts nothing.
- The UI's loading and error states before a workspace is read are English (the language comes with the workspace).
- An answer streamed by a real agent: Claude Code's `--include-partial-messages` lines are parsed from its
  documented shape and a fake command; no paid call was made. The local Nuclear Developer gives its answer whole
  (no `text-delta`), as OpenCode, Codex, Gemini CLI and the API loop do for now (the Builder's roadmap).
- Tenor's and Giphy's real searches (what keeps spec 013 T1.4 open, the rest of it is done): an `Http` connection takes no fake transport in a project's tests (the
  backend platform's roadmap); only the mapping of their answers and the paths without a call are tested.
- The keyring on macOS and Windows (a fake `secret-tool` on Linux is tested), and the service at login there.
- The AI archive with the service (`installer/release/ai-runtime.sh`): written, not run on this machine.
- The responders on Windows (`os.killpg`, the tests' `sh`).
- The service under load: every read folds a channel's whole file (fine for a project's chat; an index per
  channel if one grows to many thousands of lines).

## To decide with the user
- A workspace is not kept by the service across a restart: the host registers its project on every start (what
  the project keeps, channels and history, stays). Decided while building; confirm.

## Pending
- **Open a thread or a message from the path**: the hosts open the chat on a channel (`/<workspace>/<channel>`);
  a notification of the editors ("Askia answered you") should open the thread and scroll to the message
  (`?thread=<id>&message=<id>`, the web platform's route query). Until then it opens the channel.
- A CI workflow that builds `system/`, `nuclear_chat/` and `ui/` and runs their tests, pyright and the embedded build; then the badge in
  `README.md` and a page on the website.
- The knowledge base: `nuclear-graph knowledge build`, `check`, `ingest` once the platform's other changes of
  2026-11-18 are in.
- The remaining pyright errors of `nuclear_chat/build/` are the `python` dialect's `Json.encode` helper (its
  roadmap).
