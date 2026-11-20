# Security

## Report a vulnerability

Please do not open a public issue. Use GitHub's private reporting:
[**Report a vulnerability**](https://github.com/nuclearlang/lang/security/advisories/new). Say what is affected, how to reproduce it and what an attacker gains. You will get an
answer within a week, and a fix or a plan within thirty days for a confirmed issue; you are credited in the release
notes unless you prefer not to be.

## Supported versions

The latest release only (every part of NuclearLang carries one version:
[ADR-platform-0011](docs/03-adr/0011-one-version-one-release.md)). `nuclear update` installs it.

## What NuclearLang does today, and what it does not yet

Stated as it is, so you can judge the risk (the full list is
[spec 018, group M](docs/04-specs/018-failure-matrix/requirements.md)):

- **Downloads are checked by a SHA-256 checksum** published in the same GitHub release. The release archives are
  **not signed** yet, and the Windows and macOS binaries are **not code-signed** yet (Windows SmartScreen and macOS
  Gatekeeper may warn).
- **Everything runs on your machine.** The Smart Graph listens on `127.0.0.1` with a token on every route and
  encrypts what it stores; the local agents' service (Nuclear Developer, port 7879) has **no token yet**. Nothing
  is sent anywhere except the AI provider you choose and the daily update check (the URL of the latest release
  only; `NUCLEAR_NO_UPDATE_CHECK=1` turns it off).
- **No telemetry** is collected.
- The installers need **no administrator rights**: everything goes into your user's folders.

Signing, provenance attestations and an SBOM per release are planned
([spec 019](docs/04-specs/019-launch-and-growth/tasks.md), T3.7).
