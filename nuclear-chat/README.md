# Nuclear Chat

No CI workflow tests it yet, and it has no page on the website yet ([roadmap](docs/01-product/roadmap.md)).

## What it is

The factory's workplace: channels, direct messages, threads, mentions, reactions and GIFs, where you work with the
members of your software factory's teams the way a company works in Slack. It is local, and it is one component
that both Nuclear Builder and Nuclear Atlas use.

## Why it exists

- Work you take part in beats logs you read afterwards. You write to a team or to one member. They ask when they
  do not understand, and every run tells its work in its team's channel.
- Each member answers as themselves: their profile is their character, and their provider is how they think. A
  message to a team goes to its tech lead.
- Everything stays private: the history lives in your project (`.nuclear/chat/`). Nothing leaves the machine
  unless you turn on a GIF service or put a paid provider on a member.
- Left out on purpose: several users, calls, files bigger than an image, and Slack itself (no account, no bridge).

## How we made it

- It is a component of its own, used by every tool that talks
  ([ADR-platform-0007](../docs/03-adr/0007-everything-is-a-component.md),
  [ADR-platform-0008](../docs/03-adr/0008-nuclear-chat-the-factorys-workplace.md)).
- Its service is a Synapsis backend written in Nuclear, made with `nuclear new`, `make` and `gen`. What the
  platform cannot say yet (a file, a process, the keyring) is a small `python` library, also written in Nuclear
  ([ADR-chat-0001](docs/03-adr/0001-a-synapsis-service-and-a-system-library.md)).
- Its page is a Synapsis web app written in Nuclear, built as one module an editor's page mounts. Its calls come from
  the service's contract and go through the host, which holds the token; it follows the editor's theme.
- The history is append-only JSON lines: an edit or a reaction is a new line, and a crash never costs a message.
- The GIFs come from a pack drawn for the project (36 animated SVGs) and work offline. Tenor or Giphy are used
  only with your key in the keyring and your yes.

## Try it

```sh
cd nuclear-chat/system && nuclear build .
cd ../nuclear_chat && nuclear build . && nuclear install && nuclear test     # 18 passed
nuclear-builder setup                  # its last step starts the service at login (port 7880, token in the keyring or, without one, a 0600 file)
nuclear-chat connect --json            # {"url": "http://127.0.0.1:7880", "header": "X-Chat-Token", "token": "…"}
curl -s 127.0.0.1:7880/gifs/pack       # 401: every route needs the token (and no Origin: 403)
nuclear-chat pack                                                            # the pack's folder
cd ../ui && nuclear build && nuclear install && nuclear test                 # the page: 18 passed
cd build/app && npm run build:embed                                          # dist-embed/embed.js, mounted by a host
```

## Where to read next

- [The guides](docs/08-guides/README.md): connect a host, keep a GIF service's key.
- [The API](docs/02-architecture/api.md), [the responders](docs/02-architecture/responders.md) and
  [the UI](docs/02-architecture/ui.md).
- [AGENTS.md](AGENTS.md), to change it.
