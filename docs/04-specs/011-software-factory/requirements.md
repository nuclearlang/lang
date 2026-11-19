---
status: approved
owner: Julian Molina
updated: 2026-11-18
related: [design.md, tasks.md, ../009-self-contained-ai-services/tasks.md, ../../03-adr/0003-the-ai-loop.md]
---
# Spec 011: the software factory — Requirements

## Goal

Nuclear Builder becomes a **software factory**: every spec goes through the same stations, in the same order, each
run by a **role** whose behaviour, skills, templates and checks are files, not code. Any role can be done by the
local agents, by a provider's agent (Claude Code, Codex, Gemini CLI, OpenCode) or by a provider's model through an
API. Everything a role does is written down. Asked by the user on 2026-11-17.

## The stations and their roles

| # | Station | Role | What it delivers |
|---|---|---|---|
| 1 | Analysis | **Analyst** (product owner, owner of the product) | the request understood: questions to the user, facts from the client, the internet and the Smart Graph; the acceptance criteria made checkable |
| 2 | Design | **Architect** (solutions architect, planner) | the design and the plan: components, relations, diagrams, the ADRs of the project it follows or proposes, checked against the Smart Graph |
| 3 | Tests first | **Developer** | the tests (TDD) from the spec, the design and the plan |
| 4 | Code | **Developer** | the code that makes those tests pass, following the design and the acceptance criteria |
| 5 | Quality | **QA** (tester) | first a plan: functional and non-functional checks, edge cases, security, good practices, load and performance; then the checks the user approves, run by the user or by the role |
| 6 | Delivery | **Delivery** (delivery and documentation) | owns the definition of done: checks it, writes the documents, the user stories and the pull request; pushes to GitHub only when the user approves, and never merges (the merge is the user's) |

*Amended 2026-11-18 (the user):* the role of station 6 is **DevOps** (was *Delivery*): the infrastructure (CI/CD,
deployments, environments, containers, monitoring, secrets) and everything Delivery had (the definition of done, the
documents, the user stories, the pull request after the user's approval, never a merge). The station keeps its name,
*Delivery*; the role's id becomes `devops`, and what earlier versions wrote with `delivery` is converted on read.

## Requirements

1. **One source per role.** A role is a folder of files: what it is for, what it receives and delivers, what it
   never does, its skills (how-tos), its templates (the documents it writes) and its checks. The local agents and
   every provider read the same folder; nothing of a role is repeated in code or in another file.
2. **A role is an assignment, not a model.** For each role the user chooses who does it: the local agents (the
   Nuclear Developer, its models up to 3B), a provider's agent, or a provider's model through an API; and, when
   the provider has several, the model.
3. **The assignment is chosen per member** (changed by requirement 33, ADR-platform-0010: there are no presets):
   local only, a provider leading the local agents, or providers only are each a choice of who works the members.
   A project names its team in `.nuclear/builder.json`.
4. **Agents, not only models.** A provider's agent works with its own loop, tools, skills and sub-agents; the
   factory hands it the role's files in that agent's own format and the Nuclear MCP server. A provider's model
   through an API works through the factory's own loop with the same role files.
5. **A vault for keys.** An API key (Anthropic, OpenAI, Google, OpenRouter) is kept in the system's keyring, never
   in a file of the project or in the settings; an agent that has its own login (Claude Code, Codex, Gemini CLI)
   needs no key.
6. **Everything is documented.** Each station writes its documents in `specs/<id>/` from its role's templates; a
   run can be read later without the tool.
7. **The plans are the user's.** The QA plan (and every station's checks) is shown as a console: each check can be
   switched on or off, its moment (station) changed, and the user can add a check of their own as a prompt for a
   role. Checks that need the user's machine or judgment (a load test, a manual test) are given to the user to run.
8. **The user configures the line**: which stations run, where the run stops for the user's approval (after the
   analysis, after the design, before the delivery by default), and the commands of each station.
9. **The pipeline shows who has control.** The run is drawn as an interactive work diagram, in the manner of n8n
   and with C4's levels: the stations as nodes with the role at each, the hand-over from one role to the next
   flowing along the edges, the one working now; a station opens to what is inside it (its steps as components,
   how its agent organised the work); a click on a role shows its assignment, its files and what it did.
10. **One budget per run**, for every provider together: 5 USD by default; Claude's default model is `haiku`. A
    run stops before a call that would pass it.
11. **The language of the platform**: the factory, its roles and the documents it writes are in English; the
    local agents only ever see Nuclear and the platform, never a dialect's language.
12. **Nuclear first.** The factory's engine is written in Nuclear (spec 009, T3.1b): this spec replaces the port of
    today's TypeScript engine; the editors draw what it writes, as today.
13. **Teams.** The user hires an *employee* for each role from a roster, the way a football game picks its
    players: each card shows a satirical profile (a funny generated name, a place, an age, a university, a
    profile, a bio, a note of the "HR agent"), 40 per role, 200 in all. A team is the five hired employees with,
    for each, who does the work (the local agents, a provider's agent, a provider's model), the model, the skills
    switched on, extra instructions and skills written by the user, the behaviours and the tasks: all from the UI,
    never by editing a role's files. The user keeps several teams, mixes agents and models, and picks the team of
    each run. Teams are never lost: written atomically with the previous version kept, outside the extension's
    storage, exportable and importable.
14. **First-run onboarding covers every setting.** The welcome window walks the user, *Next, Next*, through every
    setting of the platform: the machine and the profile, what it needs, the providers and their keys, the team,
    the spending, the settings of each tool. Defaults are proposed for everything. Everything lands in the
    settings; a tool that offers a setting (the Builder's team, its budget) opens the settings there.
15. **Settings by component.** Each tool owns its settings, in code (one settings module per tool) and in the UI
    (one section per tool in VS Code's settings and in *Settings and integrations*): the AI services, the
    Builder, Nuclear Atlas, HTTP Connections, the devices, the spending.
16. **Money is confirmed twice.** Before anything that can spend money (a provider's agent or model), the user
    confirms, then confirms again with the amount at stake. A setting lets the user stop being asked; a *force
    confirmation* setting, also per project in `.nuclear/builder.json`, makes both questions come back whatever
    the user chose. A command line run asks the same, or needs `--confirm-spending` when it cannot ask.
17. **C4's four levels.** The run's diagram opens at *Context* (you, the team, the providers, the Smart Graph,
    GitHub, the project), then *Containers* (the stations), *Components* (inside a station: its steps) and
    *Code* (inside a step: what its agent followed, its decisions, its files, its tool calls).
18. **English and Spanish.** Every text the extensions show (commands, settings, pages, the onboarding, the
    Builder, the roster's 200 profiles) exists in English and Spanish and follows the editor's language; English
    is the source and the fallback. The code, the documents and the roles' files stay in English (the
    platform's rule: Spanish is localization data).
    *Amended 2026-11-18 (the user):* a language button like a website's (a globe in every page's header and in the
    status bar) chooses *Automatic* (the editor's language, else the operating system's), English or Spanish; the
    choice is the setting `nuclear.language` (`auto|en|es`), asked in the onboarding, and changes every page, the
    host's messages, Nuclear Chat and what the agents answer in at once, without a restart. What VS Code itself
    draws from `package.json` (command titles, the settings' descriptions) follows the editor's language: VS Code
    does not let an extension change it, and the button says so.
19. **The Builder is a workbench**, not a spec form: writing a spec is one step among many. Its screen, after n8n:
    on the left *New*, the specs organised by business component (and by layer when a spec touches one), and the
    runs as an accordion (several can run at once) opening to their stations and steps; in the middle the run's
    diagram; on the right the selected node's description at its C4 level above, the team with the log of what
    each one does below; under the diagram, always there, the chat.
20. **Specs by business component and layer.** A spec belongs to a business component (the default) and, when it
    touches one, to a layer (presentation, domain, data); a spec of the whole project is global. They are kept
    that way on disk, never in one flat folder.
21. **The chat is the general agent**: always on the Builder's screen, worked by the provider the user configured
    (local or external, in the onboarding and the settings). The user asks it to write a spec's base from a few
    lines, to say what was done and what not, to explain a run; it writes through the same tools (it never edits
    a role's files), and anything it spends is confirmed like a run.
    *Replaced by spec 013 (Nuclear Chat, the factory's workplace, 2026-11-18): the chat is a component of its own,
    the Builder one of its hosts.*
22. **The team means something** (2026-11-18). Wherever the Builder shows who works, it shows the employee's name,
    their role and who really does the work (the provider and the model: *Neo · Developer · Claude Code ·
    haiku*), never a paragraph about the role. The Smart Graph and the shell appear only in a step they took part
    in.
23. **The node reads like a debugger.** The selected node shows its steps by title only, each with its status,
    who did it and how long; a click opens the step to its inner process (its trace, its tool calls, its
    decisions, its files), and what those did, level by level, as a debugger's frames and variables. Nothing is
    open that the user did not open.
24. **The log, and the team's logo.** Under the node only the log of the run, one line per thing done (who, what),
    each opening to its detail; under it the logo and the name of the team doing the work. No grid of the team,
    no list of what each role does.
25. **The specs and the runs in the Workspace's column.** The specs' tree and the runs' accordion live in the
    Nuclear Workspace's column (the space beside the strip that described the tool) while the Builder is the open
    tool; the Builder's page keeps the diagram, the chat and the node.
26. **Teams as a company.** The user builds their own software company: teams, each with a name, a logo (an image
    the user picks, else one drawn from its initials) and a description; each member with a name and a
    personality (the roster's profile, editable); a team is put to work on one spec or several, and several teams
    work at once.
27. **Faces with personality** (2026-11-18, changed the same day: the drawn faces looked like cartoons). Every
    employee of the roster has a painted, lifelike cyberpunk portrait (like a concept artist's: real skin and
    light, neon city behind, implants, visors, jackets), made by an image model **on the user's machine** (no
    paid service), from a prompt written from the employee's profile and temperament: the arrogant one looks
    arrogant, the joker grins. One per employee (200), checked into the repository, the same face on the diagram,
    the company screen, the log and in Nuclear Chat. Wherever a role shows, its employee's name shows first
    (*Neo* · Developer · Claude Code), never the role alone.
28. **A temperament per member**, from a compendium of workplace personalities kept in one data file (about
    twenty-five: extrovert, introvert, shy, nerd, sarcastic, optimistic, grumpy, perfectionist, chaotic, formal,
    joker, arrogant, paranoid, passive-aggressive, burnt-out veteran, and more), each with how that person writes.
    Each employee of the roster comes with one, the user can change it, and in Nuclear Chat the member writes as it
    (how much they say, their tone, their emoji and GIFs), never changing what is true in the work.
29. **The roster's people** (the user, 2026-11-18): each employee has a gender that matches their name and face;
    QA, testing and documentation (the QA and Delivery rosters) are mostly women, the Developer roster mostly men;
    every roster has both.
30. **The company screen looks like the platform, not a game**: a professional, cyberpunk HUD in the platform's
    colours and the website's style (thin neon frames, corner brackets, monospace labels, dark panels, like n8n's
    density), never rounded toy-like cards. A member's card is a character sheet: the portrait, the name, the
    role, the temperament, who works it (provider, model), the stats as bars, the bio and the HR note.
31. **A member's profile reads like a LinkedIn profile, summed up** (the user, 2026-11-18): a banner, the portrait,
    the name, a headline, the place and the number of connections; *About* (the bio); *Experience* (two to four
    satirical past jobs, with company, title, years and one line each); *Education*; *Skills* with endorsements by
    teammates; *Recommendations* (one or two lines from other employees of the roster, in their temperament's voice);
    *Activity* (what they did in this project's runs and chat); *Open to* (a joke). The HUD style of requirement 30,
    the stats kept as a compact block. The roster's data carries what is not the project's.
32. **The agents can do everything the UI does** (the user, 2026-11-18; ADR-platform-0009): every action of the
    Builder's pages (specs, runs and their gates and checks, teams and members, the line's settings, the CI export,
    the connections' check) is a command of `nuclear-builder` and a tool of its MCP server, which every agent of
    the factory and of Nuclear Chat gets. So a message like "read docs/slides.pdf, write every spec with its
    criteria, then build them" is done by the agents: specs written with their acceptance criteria, runs started
    and followed, the user asked only what is the user's (the money twice, a destructive change, a gate the team
    set for the user).
33. **Teams are made by a wizard and have any number of members** (the user, 2026-11-18; ADR-platform-0010).
    *New team* opens a *Next, Next*: (1) identity — a logo (an image the user picks) and a name, with a button that
    suggests one (a game's nickname dice); (2) the purpose and the skills the team needs; (3) members suggested
    from that purpose and those skills; (4) the roster to add members from, filtered by role and category
    (temperament, gender, skills), several at once, as many per role as wanted (twenty developers if so); (5) who
    works each member (local agents, a provider's agent, an API model, with its model), each paid choice marked as
    costing money, the total of paid members said before saving. No preset clones a team. A team runs when every
    role its stations need has a member.
    A member is its profile, not its model: one agent and one model may work the whole team (*the same for
    everyone* in one click), and each member is made different by the user's instructions, skills, temperament and
    characteristics, set in the wizard. Only the agents on this machine can be chosen.
34. **Skills are real files, and the user edits them** (the user, 2026-11-18). A skill is a markdown file an agent
    follows (a `SKILL.md` with its name and description, like Claude Code's skills): technologies and domains
    (payments, bank accounts, authentication, offline sync, accessibility…), never a joke word. The platform ships a
    library of tested skills and agent files (`agent.md`) by default. A team has its skills, which every member
    inherits; a member has their own, which win over the team's. In the wizard and the member's panel the user sees
    each skill's file in a preview, clones one into the team or the member and changes it, and creates, edits and
    deletes their own — from the UI, with an editor of skills (and as commands and MCP tools, ADR-platform-0009).
35. **Models are the provider's real ones, and the machine is protected** (the user, 2026-11-18). The model list of
    each provider comes from the provider (Claude Code's, OpenCode's `models`, an API's model list, every model
    Ollama has installed, plus those it can pull), not a fixed three; choosing works every time and never blanks the
    page. A local model too big for this machine's memory is shown in red, needs the user's confirmation, and the
    form says in red that it can make the computer restart for lack of RAM.

## Out of scope

- Deploying to a server (the *Deploy* stage of today's Builder keeps working as a command of the line).
- Other forges than GitHub for the pull request (GitLab and Bitbucket stay as the CI export).
