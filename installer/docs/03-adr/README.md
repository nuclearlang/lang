# Decisions of the installers and the release

Cited as `ADR-installer-NNNN`. The format is `docs/03-adr/0000-template.md` of the tree's root. An accepted ADR is
not edited: a new one replaces it and the old one is marked `superseded by ADR-installer-NNNN`.

| ADR | Decision | Status |
|---|---|---|
| [ADR-installer-0001](0001-release-archives-and-one-line-installers.md) | A release is one archive per system, installed by a one-line installer into the user's folders | accepted |
| [ADR-installer-0002](0002-the-ai-services-come-with-the-installer.md) | The AI services come with the installer: a set-up in steps, a profile for the machine, the services at every login | accepted; §1, §2, §5, §6 superseded by 0003 |
| [ADR-installer-0003](0003-the-ai-services-bring-their-own-python.md) | The AI services bring their own Python; nothing is assumed on the user's machine; Ollama is the user's; the ports are chosen | accepted |
| [ADR-installer-0004](0004-the-smart-graph-runs-in-every-profile.md) | The Smart Graph runs in every profile; what is on the machine is used; a missing model is asked for | accepted |

A decision cited by its old platform-wide number (`ADR-00NN`, in code or commits before 2026-11-16): see
[the table of old numbers](../../../docs/03-adr/old-numbers.md).
