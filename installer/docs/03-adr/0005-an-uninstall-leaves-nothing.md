---
status: accepted
date: 2026-11-19
deciders: Julian Molina
---
# ADR-installer-0005: An uninstall leaves nothing of NuclearLang; what was on the machine before stays

## Context and problem
The public installers' `--uninstall` took away the installation and the services but left the definitions cache,
the graph's and the chat's data, the folder of the machine's choices, the models the set-up downloaded and the
Ollama it installed. On the first install on macOS (2026-11-19) the user had to clean by hand, file by file.

## Decision
- The public installers' `--uninstall` leaves nothing NuclearLang made: it runs `nuclear-builder setup --remove
  --all`, then takes away the installation, the links, the skill, the PATH lines, the compiler's cache, the folder
  of the machine's choices and the extension of every editor it finds.
- `--remove --all` takes away what the set-up made: the services, the MCP server in each AI client, the models it
  downloaded, Ollama when it installed it, the graph's and the chat's data and their secrets in the keyring, and
  its folder (Nuclear Builder's teams, keys and runs with it).
- What was on the machine before stays: the set-up writes in the machine's file what it installed
  (`NUCLEAR_INSTALLED_OLLAMA`) and what it downloaded (`NUCLEAR_PULLED_MODELS`), and only that is removed.
- Ollama on Linux was installed into the system by its own installer: removing it needs the administrator, so
  without a terminal the set-up says the commands instead of running them.
- `nuclear-builder setup --remove` alone (the editors' button) still keeps Ollama, the models and the data.
- On Windows the services are processes of the installation (no service manager): they are stopped before anything
  is removed, or Windows keeps the files they hold; the uninstaller says when a folder could not be removed instead
  of reporting it done (found by `installer-windows.yml`, 2026-11-20).

## Consequences
- Positive: one command leaves the machine as it was before the install.
- Negative: an uninstall deletes Nuclear Builder's teams, keys and chat history with it; there is no undo.

## References
- ADR-installer-0002, ADR-installer-0004; `extensions/tools/nuclear-builder/setup.nuc` (`remove`, `purge`),
  `installer/release/install.sh`, `install.ps1`; [the guide](../08-guides/ai-setup.md).
