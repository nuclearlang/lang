---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/integrations.md, ../02-architecture/exact-facts.md, ../06-runbooks/install-and-serve.md]
---
# Security

Never weaken one of these rules to make something easier: build the access the right way (`connect`, or a request
the user allows).

## Who may read it

Nothing reaches the graph without a token, and no token exists until you allow it.

| Command | What it does |
|---|---|
| `nuclear-graph connect <client> --scopes read,write` | gives a program access now and keeps its token in your keyring (`--print`: prints the token instead of keeping it) |
| `nuclear-graph requests` | the pending access requests and the allowed clients |
| `nuclear-graph allow <request>` / `deny <request>` | answers a request a program made (`POST /v1/access`) |
| `nuclear-graph revoke <client>` | takes a client's access away (its token stops working at once) |

Scopes: `read` (search, cards, prompts), `write` (remember, add examples), `admin` (ingest, manage: only you, with
the owner token). The two clients of this ecosystem:

```sh
nuclear-graph connect mcp --scopes read,write                 # the MCP server
nuclear-graph connect nuclear-developer --scopes read,write   # the local agents
```

A program reads its token from `NUCLEAR_GRAPH_TOKEN`, else from the keyring. Without a keyring, `connect` writes
the token to a file of the data folder that only you can read.

## How it is protected

- The server listens on `127.0.0.1` only; a request with an `Origin` header (a web page) is refused.
- Every route but `/v1/health` and the access request needs a token. Tokens are stored as SHA-256 hashes, compared
  in constant time, and an allowed request hands its token once.
- Documents are encrypted at rest (AES-256-GCM). The key and the owner token live in the desktop keyring
  (`secret-tool`, libsecret), or in `0600` files of the data folder when there is no keyring.
- A graph that starts while its keyring is closed (a service at login) waits for it and never makes a second key or
  token.
- The data folder (`$XDG_DATA_HOME/nuclear-graph`, `0700`) is opened only by the server process.
- Only `ingest` writes the shelves of the base: a client writes `memory` and `examples` and cannot plant false
  documentation.
- The exact facts are never written to disk: the database is made in memory from the sealed cards, and is
  read-only.
- The key of a search engine for the agents (`nuclear-graph web-key brave`) is read from stdin and kept with the
  other secrets. The internet tools refuse local addresses.

## Sensitive data

| Data | Where | How it is protected |
|---|---|---|
| The text of a card | Chroma, the document | encrypted (AES-256-GCM) |
| The vectors and the metadata (ids, titles, keys) | Chroma | in clear: Chroma searches them. They reveal what a row is about, not its text |
| The documents' key, the owner token, each client's token | the keyring, or `0600` files | per OS user |
| The tokens the server checks | the data folder | SHA-256 hashes |
| The exact facts (names, summaries) | the server's memory | never on disk |

## Limits

Protection is per OS user. A program running as you could ask the keyring for the key as the graph does; the graph
stops other users, web pages and programs that only speak HTTP or MCP.
