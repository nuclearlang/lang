# The library of skills and agents

Spec 011 requirement 34: skills are real files. Each folder here is one skill, `<id>/SKILL.md`, in Claude Code's
format, written for NuclearLang and Synapsis work; `../agents/<id>/agent.md` are the agents a team member can take
as their base. Nuclear Builder reads them (`nuclear-builder skills list`): a team attaches skills by id (every member
inherits them), a member adds its own, and the user previews, clones and changes them, or writes new ones, from the
UI, the commands and the MCP tools. These files are never changed by a team: a clone is the team's or the member's
own, kept in the team file.

## A skill's file

Front matter, one `key: value` per line (no quotes, a list as `[a, b]`):

| Field | What it is |
|---|---|
| `name` | its id: the folder's name, lowercase with dashes |
| `description` | one English sentence: what it does and when to use it (what an agent triggers on) |
| `title`, `title_es` | its title in words, in English and Spanish (the screens) |
| `description_es` | the description in Spanish |
| `kind` | `domain`, `technology` or `practice` (the wizard groups them so) |
| `tags` | words people type (the search) and the wizard's member suggestions read |

The body, in English: `## When to use`, `## Steps`, `## The platform's tools` (the real `nuclear` and
`nuclear-builder` commands and words, never invented), `## Pitfalls`, `## Checklist` (`- [ ]` items). When the
platform lacks something, the skill says so and how to do it with the tools. An agent's file has `role` (one of the
factory's) and `skills` (ids of this library) instead of `kind` and `tags`, and its body is the agent's text.

## The skills

- **Domains**: [`accessibility`](accessibility/SKILL.md) Accessibility, [`analytics-events`](analytics-events/SKILL.md) Analytics events, [`audit-logging`](audit-logging/SKILL.md) Audit logging, [`authentication`](authentication/SKILL.md) Authentication and sessions, [`bank-accounts`](bank-accounts/SKILL.md) Bank accounts and transfers, [`file-uploads`](file-uploads/SKILL.md) File uploads, [`i18n`](i18n/SKILL.md) Translations and localization, [`maps-geolocation`](maps-geolocation/SKILL.md) Maps and geolocation, [`notifications`](notifications/SKILL.md) Notifications, [`offline-sync`](offline-sync/SKILL.md) Offline-first sync, [`payments`](payments/SKILL.md) Payments, [`privacy-gdpr`](privacy-gdpr/SKILL.md) Privacy and GDPR, [`realtime-chat`](realtime-chat/SKILL.md) Chat and real time over WebSockets, [`search`](search/SKILL.md) Search, filters and pagination, [`subscriptions-billing`](subscriptions-billing/SKILL.md) Subscriptions and billing, [`user-profiles`](user-profiles/SKILL.md) User profiles.
- **Technologies**: [`ci-pipelines`](ci-pipelines/SKILL.md) CI pipelines, [`ollama-local-models`](ollama-local-models/SKILL.md) Local models with Ollama, [`openapi-import`](openapi-import/SKILL.md) Importing an API, [`rest-contracts`](rest-contracts/SKILL.md) REST APIs and contracts, [`sql-databases`](sql-databases/SKILL.md) SQL databases, [`synapsis-backend`](synapsis-backend/SKILL.md) Synapsis backend, [`synapsis-mobile`](synapsis-mobile/SKILL.md) Synapsis mobile, [`synapsis-web`](synapsis-web/SKILL.md) Synapsis web, [`testing-in-nuclear`](testing-in-nuclear/SKILL.md) Testing in Nuclear, [`websocket-connections`](websocket-connections/SKILL.md) WebSocket connections.
- **Practices**: [`clean-architecture-components`](clean-architecture-components/SKILL.md) Clean architecture with components, [`code-review`](code-review/SKILL.md) Code review, [`performance-load`](performance-load/SKILL.md) Performance and load, [`security-review-owasp`](security-review-owasp/SKILL.md) Security review (OWASP), [`tdd`](tdd/SKILL.md) Test-driven development.

## The agents

| Agent | Title | Role | Skills |
|---|---|---|---|
| [`backend-engineer`](../agents/backend-engineer/agent.md) | Backend engineer | developer | 12 |
| [`mobile-engineer`](../agents/mobile-engineer/agent.md) | Mobile engineer | developer | 11 |
| [`qa-security-tester`](../agents/qa-security-tester/agent.md) | QA and security tester | qa | 9 |
| [`tech-writer`](../agents/tech-writer/agent.md) | Technical writer | devops | 7 |
| [`web-engineer`](../agents/web-engineer/agent.md) | Web engineer | developer | 11 |

## Checks

- `../roles/tests/test_library.nuc` (`cd ../roles && nuclear build . && python3 -m pytest -q`): every file's front
  matter and Spanish, the sections, a checklist, every `nuclear <command>` and `nuclear-builder <command>` real
  (against `nuclear help commands` when it is on the machine), every agent's skills in the library.
- Nuclear Builder's `tests/test_skills.nuc`: each skill reaches every provider whole (Claude Code's plugin skill,
  OpenCode's agent, Codex's `AGENTS.md`, Gemini CLI's `GEMINI.md`, an API model's prompt, the local Developer's
  context).

A new skill is a folder with its `SKILL.md`; both checks run on it with nothing to register.
