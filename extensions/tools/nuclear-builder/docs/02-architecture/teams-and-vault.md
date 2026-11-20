---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [providers.md, engine.md, ../../../../../docs/04-specs/011-software-factory/design.md]
---
# Teams and the vault (`teams.nuc`, `vault.nuc`, `roles.nuc`)

The software factory's teams and API keys, in Nuclear (`python` dialect). The editors run each command as a
process, one call per action: JSON on stdout, an error as `{"error": "…"}` with exit code 1.

## The roles (`roles.nuc`)

- `ROLES`: `analyst`, `architect`, `developer`, `qa`, `devops`. `STATIONS`: `analysis`, `design`, `tests`, `code`,
  `quality`, `delivery`; `STATION_ROLE` says who works each one when a `role.md` does not (the `delivery` station:
  `devops`). `OLD_ROLES` (`delivery` → `devops`, spec 011's amendment) and `roleId(role)`: a role named by its id of
  before is read as today's in a team (`healTeam`: written once, the old file kept as `<id>.json.bak`; the member
  keeps its id, so a chat's `<team>-delivery` stays), a run (`upgradeRun`: its stations, steps and `assign`, the file
  not rewritten), `--role` and `--assign` of a command and a tool's `role`; the alias is taken for one release more.
- `rolesDir()`: `NUCLEAR_ROLES`, else `roles/` beside the package, else the AI installation's
  `nuclear-agents/roles`, else the working tree's. `roster(role, lang)`: `roster/<lang>.json`, English when the
  language is missing, `[]` when the role has no roster: never an error (the wizard's roster step, with every role
  empty, says the installation came without one and to run the installer again; the AI archive carries them). Each employee whose portrait is there
  (`roster/faces/<id>.webp`, a painted portrait of 512 px, spec 011 requirement 27) gets its whole path as `face`, and
  its thumbnail (`roster/faces/thumb/<id>.webp`, 128 px, a few KB) as `thumb`; each has its `temperament`.
- `temperaments()`: the list of `temperaments.json` beside the roles (`[{ id, name: { en, es }, description: { en, es }, voice, look }]`,
  requirement 28), `[]` without the folder.

## A team (`teams.nuc`)

A team is the members the user hired, any number per role ([ADR-platform-0010](../../../../../docs/03-adr/0010-a-team-is-its-members.md));
there are no presets.

- The file: `~/.config/nuclearlang/factory/teams/<id>.json` (`%APPDATA%\nuclearlang\factory\teams` on Windows;
  `NUCLEAR_FACTORY_HOME` moves the whole folder):
  ```json
  { "id": "night-shift", "name": "Night shift", "description": "", "purpose": "A mobile shop", "skills": ["payments"],
    "ownSkills": [{ "id": "house-style", "name": "House style", "description": "How we write.", "text": "## Steps\n…" }],
    "logo": null, "techLead": "dev-017", "budgetUsd": 5, "updated": 1763000000000,
    "members": [{ "id": "dev-017", "role": "developer", "employee": "dev-017", "name": "", "kind": "local",
                  "provider": "nuclear-developer", "model": "qwen2.5-coder:3b", "skills": ["write-tests", "tdd"],
                  "ownSkills": [], "agent": "backend-engineer", "instructions": "", "behaviour": {}, "tasks": [], "personality": { "gifs": "sometimes", "on": ["failure"], "note": "" } }] }
  ```
- A write (`writeAtomic`) goes to a temporary file beside it, then a rename; the previous version stays as
  `<id>.json.bak`. `team delete` moves the file to `<id>.json.bak`.
- An old file (`roles: { <role>: {…} }`, one member per role, `techLead` a role) is converted on its first read
  (`loadTeam` → `upgradeTeam`): each role's member gets the role as its id (so a chat's `<team>-<role>` keeps its
  id), the tech lead that member; it is written through the normal write, the old file kept as `<id>.json.bak`.
- A value an earlier version kept that is gone today never refuses the team (`healTeam`, on read): a temperament no
  longer in the list (the employee's own is shown), a base agent no longer in the library, an employee no longer in
  the roster, a provider or a kind no longer known (the kind's default, the local Nuclear Developer), a tech lead no
  longer a member (the default lead) is left out, the old value kept in `<id>.json.bak`, and the team's `warnings`
  (texts) say each one in `team show --json` until the user saves the team. A library skill id that is gone is kept
  in the purpose (`Skills: …`) like a free word.
- `validTeam`: a name; an id of lowercase letters, digits and dashes (made from the name when missing); a budget of
  0 or more (5 USD by default); `description` and `purpose` texts, `skills` (library ids) and `ownSkills` (below). Each member
  (`validMember`): a known `role`; a `kind` of `local | agent | api` and a provider of that kind (`PROVIDERS`); texts
  for `id`, `model`, `employee`, `instructions`, `name`; an employee that is in the role's roster when there is one;
  `skills` texts (its role's switched on and library ids), `ownSkills`, `agent` (a library agent: `libraryAgent`),
  `behaviour` booleans, `tasks` `{ id, title, station, on }`. Member
  ids are unique in the team (missing: the employee's id, else the role, then `-2`, `-3`…); an employee is in a team
  once. `techLead` is a member's id; none given: the first Architect, else the first member (null in an empty team).
- **Skills** (spec 011 requirement 34, `library.nuc`, `skills.nuc`): the library is `nuclear-agents/skills/<id>/SKILL.md`
  and `nuclear-agents/agents/<id>/agent.md` (`libraryDir`: `NUCLEAR_LIBRARY`, else beside the roles' folder), read
  only. A team's `skills` are library ids every member inherits; its `ownSkills` `[{ id, name, description, text,
  from?, title_es?, description_es?, kind?, tags? }]` are its own (`name` the title, `text` the markdown body, `from`
  where a clone came from: `library:<id>`, `team:<id>`, `role:<id>`), validated by `validOwnSkills`, at most 40 000
  characters each. A member has the same two, beside its role's skills switched on in `skills`, and its base `agent`.
  What a member gets (`sharedSkills`, `withSkills`): its role's skills switched on, then the team's library skills and
  own skills, the base agent's skills, the member's library skills and own skills, each id once; **a member's own
  skill wins over the team's, the team's over the library's** (`overrides` says which). The base agent's text goes
  before the member's `instructions`. An old team's `skills` (free words before the library) become library ids when
  a word is a skill's id, title (either language) or tag; the rest go to its `purpose` as `Skills: …`, written once on
  its first read (its last version kept), and only when the library is there. An old member's `extraSkills`
  `{ name, text }` become own skills, written on the team's first read too (its last version kept).
- A member's `name` (empty: the employee's) and `personality` `{ "gifs": "never|sometimes|often", "on": ["failure" |
  "success" | "question"], "note", "temperament" }`, `sometimes` and `["failure"]` by default. `temperament` is one of
  `temperaments()` (not checked when the list is not there); a save keeps it only when it differs from the hired
  employee's, and `teamShown` gives that one when there is none. `teamShown` also gives each member without a name
  the employee's, and `missing`: the roles the six stations need that no member has.
- Who works a member when it is not said (`newMember`, for `team create` and `team member add`): the local Nuclear
  Developer with the profile's `CODER_MODEL` for a developer and `ASSISTANT_MODEL` for the rest (`localWorker`); every
  skill of its role on; a free id.
- Who works a member is an agent this machine has (`workableHere`, `chat_agents.nuc`, the rules of `agents --json`:
  `whyNotHere`; an agent that cannot gives `why` in English and `whyKey`, `whyArgs` (`notOnPath`, `noKey`, `noPrice`,
  `noAnswer`), which the screens say in their language): an agent's command on the tools' PATH, an API provider whose key the vault notes and that has a
  priced model; the local Nuclear Developer always. `team create`, `team member add` and `team member update` (a
  new kind or provider), and their tools, refuse one that is not, with why; a plain save does not check it, so a team
  made on another machine still opens.
- `localTeam()`: a run's team when there is none at all: one local member per role (id the role, the first employee
  of its roster), id `local-team`, never saved; a retried run of it gets it again.
- The logo (`setLogo`): `team logo <id> <image>` checks the image by its extension (`.png`, `.svg`, `.jpg` or
  `.jpeg`), its size (1 MB at most, `LOGO_MAX_BYTES`) and its first bytes (PNG's and JPEG's signatures; an SVG holds
  `<svg`), copies it atomically beside the team as `<id>.logo.<kind>`, names it in the team and removes a logo of
  another kind; `--clear` removes it. `team import` drops the logo (the image is not in the file).
- The default team: `factory/settings.json` `{ "defaultTeam": "<id>" }`; the first team saved becomes it.
- `runTeam(root, asked)`: the team asked for (the editor's `nuclear.builder.team`), else the project's
  `.nuclear/builder.json` `"team"`, else the default team, else the only saved team; null with no saved team; a
  `TeamChoice` with several and none chosen (engine.md "The team"). Who works each station of a run: engine.md.

## The wizard's suggestions (`suggest.nuc`)

Deterministic, no model:
- `team suggest`: each employee against the words of the team's purpose and skills (three letters or more, no
  stopword, light stemming: *tests*, *testing* and *tester* meet; five letters or more also meet by prefix). Each word
  counts once, by the heaviest source it met: a skill 3, an endorsed skill 2, the headline 2, an experience line, the
  profile or the bio 1. The best three of each role (the mean of the stats breaks ties, so a role with no word met
  still gets its all-rounders), each with `why`: `[{ "term", "in", "text" }]`, the heaviest first.
- `team name-suggest`: five different names, each a pattern of `team-names.json` in the roles' folder
  (`{ "en" | "es": { "patterns", "adj", "noun", "thing", "suffix" } }`, nuclear-agents/roles/README.md) filled at
  random; `{topic}` is a word of the purpose, and its patterns are used only with a purpose; `--seed` gives the same
  names again.

| Command | Prints |
|---|---|
| `team list --json` | `[{ "id", "name", "description", "logo", "techLead", "members" (how many), "updated", "default" }]`, by name; `logo` is the image's whole path (null without one); a file that cannot be read is listed too, with its `error` (never left out) |
| `team show <id> --json` | the team as `teamShown` gives it (with `missing`) |
| `team create --json` | a new team from the draft on stdin `{ name, description, purpose, skills, budgetUsd, techLead (a member's id or index), logoFile, members: [{ role, employee, name, kind, provider, model, … }] }`, its own free id, saved |
| `team suggest [--purpose …] [--skills a,b] [--lang en\|es] [--limit n] --json` | `{ "purpose", "skills", "terms", "roles": [{ "role", "candidates": [{ "employee", "name", "role", "headline", "face", "temperament", "gender", "score", "why" }] }] }` |
| `team name-suggest [--purpose …] [--lang en\|es] [--seed n] --json` | five names |
| `team runnable <id> --json` | `{ "team", "runnable", "missing", "stations" }`, the stations of the project's line |
| `team member add <id> --role … [--employee …] [--kind] [--provider] [--model] [--name] [--count n] --json` | the team; `--count` adds that many of the same who-works; without `--role`, a member or a list of members on stdin |
| `team member remove <id> <member> --json` | the team; the tech lead's place goes to the default when it was them |
| `team member update <id> <member> [--kind] [--provider] [--model] [--employee] [--name] [--skills a,b] [--extra-skills <json>] [--instructions] [--temperament] [--gifs] [--on] [--note] [--agent <id>] --json` | the team; a kind changed without its provider takes that kind's first; `--agent ""` takes the base agent away |
| `team skills set <id> [--member <m>] --skills a,b --json` | the team: its library skills (or the member's, its role skills on kept); an id that is not in the library is refused |
| `skills list [--team <t>] [--member <m>] [--lang en\|es] --json` | `{ "library": [{ id, title, description, kind, tags, from }], "agents": [{ …, role, skills }], "team"?: { id, skills, own }, "member"?: { id, role, agent, roleSkills, skills, own }, "composed"?: [{ id, title, description, from: library\|team\|member, overrides }] }` |
| `skills show <id> [--team] [--member] [--lang] --json` | the skill as that place sees it (the member's own, the team's own, the library's, an agent, the member's role's): `{ id, title, description, kind, tags, from, clonedFrom?, markdown, editable }` |
| `skills clone <id> --team <t> [--member <m>] --json` | the team: a copy as the team's or the member's own with the same id (a member's from the team's own, else the library's, else its role's); refused when it is its own already |
| `skills create\|update <id>\|delete <id> --team <t> [--member <m>] --json` | the team; create and update read the SKILL.md on stdin (`ownSkillOf`); update keeps the id and `from`; a library skill is never updated (clone it) |
| `team update <id> [--name] [--description] [--purpose] [--skills a,b] [--lead <member>] [--budget <usd>] --json` | the team |
| `team logo <id> <image> --json` · `team logo <id> --clear --json` | the team with its new logo (or none) |
| `team save --json` | the team read on stdin, validated, stamped (`updated`, ms) and written |
| `team duplicate <id> [--name …] --json` | the copy, its own id, no logo |
| `team delete <id>` | `{ "deleted": "<id>" }` |
| `team default <id>` | `{ "default": "<id>" }` |
| `team export <id> <file>` | `{ "exported", "file" }` |
| `team import <file> --json` | the team; an id already taken gets the next free one (`<id>-2`): an import never replaces |
| `team roster [--lang en\|es] --json` | `{ "<role>": { "employees", "skills", "skillTexts": { "<skill>": { "title", "description" } } } }`, every role; an employee's `face` is its portrait's whole path, `thumb` its thumbnail's; `skillTexts` in the language asked (the skill's `title_<lang>`, `description_<lang>`, else its name in words and its English description) |
| `team screen [--lang en\|es] --json` | everything the company screen draws, in one process: `{ "teams" (as `team list`), "shown": { "<id>": the team as `team show`, or `{ "error" }` when its file cannot be read }, "roster" (as `team roster`), "temperaments" (as `team temperaments`), "vault" (as `vault list`; null when the keyring cannot be asked) }` |
| `team temperaments --json` | `[{ "id", "name": { "en", "es" }, "description": { "en", "es" }, "voice", "look" }]`, the list of `temperaments.json` |

## A member in Nuclear Chat (`member.nuc`)

A team's members talk in Nuclear Chat ([spec 013](../../../../../docs/04-specs/013-nuclear-chat/design.md),
ADR-platform-0008); the Builder is its host.

- `nuclear-builder chat-host --json [--root <dir>] [--lang en|es]` prints the host file: `{ "host": "builder",
  "members", "channels", "teams", "lang" }`; `teams` is `[{ "id", "name", "lead": "<team>-<techLead>" }]`, the
  member who answers a message to the team (`@<role>` reaches the role's first member as listed: Nuclear Chat's
  routing). The members are every member of the project's team, any number per role, in the team's order (the run's
  team, `teamOfRun`: engine.md "The team"), each `{ "id":
  "<team>-<member id>", "name", "role", "member" (its id in the team), "team", "avatar" (the employee's id, the drawn
  face's seed; `<team>-<member id>` without one), "face" (the
  thumbnail's whole path, the chat's avatar; the portrait's without one; null without either), "temperament" (the member's, else the employee's; null), "profile":
  { "bio", "hrNote", "lang" } (the roster in `lang`), "personality", "responder": { "command": ["nuclear-builder",
  "member", "--team", "<team>", "--member", "<member id>"], "paid" }, "brain": { "agent" (the provider's name), "kind",
  "provider", "model", "paid" } }` (`paid`: a provider not `local`; `brain`: who works the member, drawn under their
  name in a direct message). Several teams and none chosen: `{ "error", "chooseTeam": [{ "id", "name" }] }`, exit 1. The channels:
  `general` (topic *The project <name>*) and the team's (`<team>`, its description as the topic, else its name),
  every member in both.
- `nuclear-builder member --team <id> --member <member id> --events [--root <dir>]` (or `--role <role>`: the
  role's first member, `memberFor`) is the responder (design.md "The
  responder"): one process per answer. stdin's first line is `{ "member", "channel", "thread", "messages" (the last
  40: `author`, `text`), "said", "lang" }`; stdout's lines are `{ "type": "typing" }`, `{ "type": "text", "text" }`,
  `{ "type": "tool", "id", "tool", "input" }` and, once it ran, `{ "type": "tool", "id", "tool", "ok", "text" }`,
  `{ "type": "ask", "id": "spending-1" | "spending-2", "kind": "spending", "question", "providers", "budgetUsd" }`
  (its answer `{ "answer": "yes" | "no" }` on stdin) and last `{ "type": "done", "costUsd"[, "error"] }`. A usage
  error (no member nor role, no `--events`, no team, no such member, a team without that role, an unknown provider, a first line that is not
  the conversation) is that `done` with its error and exit code 2.
- It is the chat's turn (`Member` extends `Chat`, chat.md): the member's provider and model through
  `runAdapter`, the factory's tools, the role files' guard, the two spending confirmations (refused in advance when
  `"forceConfirm"`), the team's `budgetUsd` (`--budget` overrides it). Its prompt is its own: the member's name and
  role and the team's, the roster's bio and HR note in `lang`, the temperament's name and, as *How you write*, its
  voice (how much they say, the tone, emoji and GIFs, never changing what is true), the personality's note, the member's `instructions`, the tech lead's part (the lead: it answers for the whole team, speaks for everyone, says which member
  owns a question and brings them in, and is accountable for the team's work; another member: who its tech lead
  is), the factory's tools, the project's components, the chat's messages, the message to answer and this
  turn's tool results; it answers in `lang`. Each conversation (a channel, or a thread of it) keeps its spending,
  cost and tool results in `.nuclear/builder/chat/member-<team>-<member>-<channel>[-<thread>].jsonl`: the confirmation
  and the budget hold for that conversation.
- `--role chat` is the general agent (Nuclear Atlas's member): `--provider`, `--model`, `--kind` as `chat` takes
  them (the local Nuclear Developer by default), the team only for its budget (`--team` optional).

## The vault (`vault.nuc`)

- The keys of the `api` providers in the system's keyring, service `nuclear-factory`, attribute `provider`:
  `secret-tool` (Linux), `security` (macOS), the password vault of Windows through PowerShell
  (`keyringCommand`). The session bus is found when the caller's environment lacks it (`keyringEnv`).
- `factory/vault.json` notes which providers the keyring keeps, never a key. A provider noted that the keyring
  does not answer for is a closed keyring: `vaultKey` waits `VAULT_WAIT` (90 s), then refuses. A key is never
  written to a file.
- `vault set <provider>` reads the key on stdin (hidden with `getpass` in a terminal), never from the command line;
  on macOS `security` takes it as an argument for that instant (a `shortcut:` in the code). `vault remove
  <provider>`; `vault list --json` → `{ "<provider>": true | false }`. Nothing prints a key; an API error has the
  key replaced by `<key>` (`apiLoop`).

## The company screen (VS Code, `src/teams/`)

*Your software company* (requirements 26, 30, 31; command `nuclear.builder.teams`, *Settings and integrations* →
Nuclear Builder, the Builder's team footer) over these commands, drawn as a cyberpunk HUD in the platform's colours
(the Chernobyl accent on the editor's background, its light twin in a light theme: thin neon frames, corner brackets,
monospace labels and header strips, no rounded cards). Every team is a framed panel: the strip `TEAM // <id> · <n>
OPERATIVES · LEAD: <name>`, its logo in a hexagon (else its initials in its colour), its name, ★ *Default*, its
description, its members' portraits (angled corners, the role's colour as the rim, the tech lead tagged `LEAD`), what it
works on as status lines with LEDs (its runs in the projects the editor knows, the ones going on first, `teamWork`)
and its run's budget as a gauge against what its latest run spent (`teamSpend`, `budgetGauge`); a panel opens the
team, *‹ Company* goes back. Step 6 of the welcome mounts the same page with no company: with no team yet, it opens
the new-team wizard.

- `cli.ts` is the contract's client: one `nuclear-builder` process per call, its JSON, `{"error"}` thrown as the
  error, a command that has no `team` (an older installation) as `CommandMissing`. The editor never writes a team
  file: a member's settings are a `team save --json` (the page sends the whole team, 600 ms after the last change); a
new team is `team create`, members added or removed `team member add|remove`.
- `host.ts` (`TeamsHost`) answers the page's `team:*` messages and asks what only the editor asks: a name
  (rename), the confirmation of a delete, the file of an export or an import, an image for the logo (handed to
  `team logo <id> <image>`, which copies it beside the team), an API key (hidden, handed to `vault set` on stdin).
  What the page draws is read in **one process**, `team screen --lang` of the editor's language (the teams, each one
  shown, the roster, the temperaments, the vault), when the page loads, a team is opened, made, duplicated, deleted,
  imported or made the default, or the language changes; a command that changes one team (a member added, removed
  or updated, a rename, the logo, a save) gives that team back and only it is replaced; a key kept asks `vault list`
  again. `agents --json` (the wizard's) runs beside it when the page loads, never in its way. Every `nuclear-builder`
  command starts in under 100 ms (the `mcp` library is loaded only by `member`, `chat-host` and `mcp`, which import
  their modules when they run). The page draws its frame at once, a shimmering skeleton of its panels until the
  state comes. With `work` (the company), the state carries the cards, each logo read as a `data:` URL (`logoData`,
  read only, 1 MB at most). The roster's pictures reach a page once per load as the page's URLs of the files
  (`rosterFaces` with `webviewFaceUrl`, `src/teams/faceUrl.ts`: the folders join the webview's roots, so the WebP
  never travel as `data:` URLs): `thumbs` (128 px) for the tiles, cards, rows and avatars, `faces` (512 px) only for
  the open profile; every picture is `loading="lazy"` and `decoding="async"` with its width and height. Typing in a
  pool's search redraws the pool once the typing pauses (120 ms), not on every key. A duplicate is `team duplicate`.
  The skills a role can switch on are the ones the command gives, never read from the role folders by the editor.
- The **new-team wizard** (*New team*, *Next, Next*, a step bar; `wizard.ts` computes it, `page.ts` draws it):
  1. *Identity*: the logo (an image, previewed in the hex frame, copied by `team create` as the draft's `logoFile`), the name with
     *Suggest a name* (a die that rolls `team name-suggest`), the description;
  2. *Purpose and skills*: a text, and the library's skills as chips grouped by kind (domains, technologies,
     practices) with a search; a chip's box adds it to the team, its name opens the **preview drawer** (the SKILL.md
     drawn as markdown, `skills.ts` `mdHtml`, with *Add to the team*, *Clone into the team*, *Clone into a member*
     and *Edit (a copy)*); *New skill* opens the **skills editor** (name, the id it gets, description, kind, tags,
     the Spanish fields folded, the markdown body with its live preview). The wizard keeps the team's and the
     members' skills and clones in its draft (`ownSkills`) until *Create team*; `team suggest` reads each library
     skill as its title and tags;
  3. *Suggested members*: `team suggest`'s candidates per role with why, each added or skipped;
  4. *The roster*: filtered by role, temperament, gender, skill and words, several chosen at once, any number per
     role; the chosen list counts each role and flags the roles the stations need that it lacks;
  5. *Who works each member*: kind, provider and model from `agents --json` and `models --json` (providers.md), local
     by default; the model is a select of every model the provider lists, every time (the installed and the
     downloadable apart for the local agents, each with the memory it needs; *Other model…* opens a field where the
     provider takes any model), a local one too big for this machine in red, asked in a dialog before it is chosen,
     and said in a red line under its row while it is; an agent this machine
     lacks is shown disabled with its why (as the chat's agent picker) and is never chosen. *The same for* sets one
     agent and model for everyone, or for all the members of a role, in one click (*All local* beside it): a member
     is their profile, not their model. Each row folds out *Make them different*: the temperament (the employee's
     own by default, or one of `temperaments.json`), their characteristics (the personality's note), instructions,
     the role's skills switched on or off and skills of their own. A PAID badge on each paid member, the count of
     paid members and the warning that Claude Code, OpenCode, Codex… cost money per run (each run asks twice before
     spending; the run's budget), the tech lead; *Create team* → `team create`, every field of the members in the
     draft.
  Editing a team (*Members…*) reuses steps 4 and 5: on *Save the members* the page sends, in order, `team member
  remove` for each who leaves (listed on step 5, the user's choice already), `team member add` for the new ones and
  `team member update` for each whose worker or differences changed; the host runs a page's messages one after the other, so two
  writes of a team never overlap. The onboarding opens the wizard when there is no team yet.
- `page.ts` draws the company (above), then the team: the bar (back to the company, the logo, a click picks another
  image, ✕ removes it with `team logo <id> --clear`; the teams, default ★, *New team* (the wizard), rename, duplicate,
  export, import, delete, *Members…*), the description (written in place), the **Team skills** strip (the team's
  library skills and own skills as chips, each opening the preview drawer; *Add from the library*: the library's
  chips in the drawer, each switched on or off with `team skills set`; *New skill*: the skills editor, saved with
  `skills create`), and three parts:
  - the **operations roster**: the members grouped by role in station order (Analyst · Analysis, Architect · Design,
    Developer · Tests first · Code, QA · Quality, DevOps · Delivery), each group with how many and *+ Add* (the pool of that role), a role with none flagged; each
    member the portrait, the member's name, role and stations, the
    temperament, provider · model with a PAID tag on a paid one, a LED (green: local; amber: a provider) and the
    `LEAD` tag; it stays in view while the page scrolls;
  - the **member panel**, to work with a member (a candidate opened from the pool or a recommendation gets the whole
    LinkedIn profile below, with *Add as another …*, *Hire, replacing …*, *Back to …*). A compact header: the
    portrait, the name, the tech lead and PAID tags, the role and its stations, the headline in one line, the status
    (*On duty*, *Working* while a step of theirs runs), *Make tech lead* (`techLead`) and *Let go* (`team member
    remove`, asked in a dialog); under it the **Brain**: one list of agent · model pairs (*Claude Code · opus*, *OpenCode
    · ollama/gemma4:12b*, *Nuclear Developer (local) · qwen2.5-coder:3b*, *Anthropic API · …*), grouped by agent, the
    paid ones marked `$`, the ones this machine lacks disabled with their why (`agents --json`, asked once per page, the
    wizard's rules), every model of each provider (`models --json`; *Other model…* where any is taken; a too-big local
    one in red, confirmed in a dialog, then a red line under the Brain), a model the machine does not list kept as it
    is; choosing one is `team member update` with its
    kind, provider and model (the agent is never asked apart). Then the tabs: **Overview** (the brain with *Change*,
    the API key's state for an API, the cost: free or paid with the team's budget, the teams this employee is in,
    tech lead or not, the temperament, the skills on of the role's and their own, the last activity: `memberActivity`
    from the host), **Person** (the member's name, empty for the employee's own, the tech lead, the temperament (its
    names and descriptions in the chosen language, `nuclear.language`, the employee's own marked), gifs never /
    sometimes / often, when, a note), **Skills** (the role's on/off, each with its title and description in the
    page's language, the roster's `skillTexts`; then the base agent, a select of the library's agents of the role, with
    its preview; then the skills it gets, from `skills.ts` `memberSkills`: its own first (*Edit*, *Delete*, which the
    host asks before `skills delete`), its library skills, its base agent's, then the team's marked *inherited from the
    team*, each override said; *Preview*, *Clone* (`skills clone … --member`), *Add from the library*, *New skill*), **Instructions**, **Behaviours**, **Tasks** by
    station, and last **Profile**: the summed-up LinkedIn profile (requirement 31): place · age · connections,
    *About* (the bio), *Experience*, *Education* (else the university), *Recommendations* (each opens its author's
    profile), *Activity*, the stats (a ring with their average, each one a segmented bar), *Skills* by endorsements
    (three, then all), the temperament with its description, *Open to*, the HR note stamped `HR // INTERNAL`. The
    roster's provider · model chip on a member's row opens the Overview with the Brain focused;
  - the **hiring pool** of a role (chosen in it, or the selected member's): a grid of portrait tiles (name,
    temperament, *In the team*), searched by words and filtered by temperament and gender (`filterRoster`), an
    inspector with the dossier of the tile under the pointer or focus; a click opens the whole profile, *+ Add* hires
    them as another member (`team member add`), a tile dropped on a member of its role replaces that member's
    employee.

  A portrait is the roster's `face` as the page's URL of the file (a `data:` URL where a page has no `faceUrl`, as the Builder's page for its members), any image type, cropped square (`object-fit: cover`); without
  one, the initials in the frame. Its texts are `l10n.ts` (`sq.*`); the scanline sweep, the bars' growth and the
  running LEDs' blink are off with `prefers-reduced-motion`; every slot, tile and panel takes the keyboard (Enter,
  Space) and shows its focus.
