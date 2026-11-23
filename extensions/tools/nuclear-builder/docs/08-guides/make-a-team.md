---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [write-a-spec.md, ask-the-team.md, ../02-architecture/teams-and-vault.md, ../../../../../docs/03-adr/0010-a-team-is-its-members.md]
---
# Make a team

A team is the people you hire from the roster, as many per role as you want: twenty developers if you need them.
Each member is worked by a provider's agent (Claude Code, OpenCode, Codex,
Gemini CLI, Cursor, Grok Build) or by an API model. Open *Your software company* (the Builder's *Team…*, or *Settings and integrations* →
Nuclear Builder) and press **New team**: five steps, *Next, Next*.

1. **Identity**: a logo (pick an image; it shows in the hexagon), the name (the die, *Suggest a name*, rolls a new
   one each time, like a game's nickname) and a description.
2. **Purpose and skills**: what the team is for, and the skills it needs from the **library**: real `SKILL.md` files
   (payments, bank accounts, authentication, offline sync, maps, subscriptions…), grouped as domains, technologies and
   practices, with a search. Nuclear's base comes in every team without choosing it, the locked chip **Nuclear base**
   (its tooltip lists them): what Nuclear and its command line do and cannot do, the Synapsis backend, mobile and web,
   tests in Nuclear, REST contracts, the component architecture, clean code, code review, the OWASP security review,
   performance with Big-O, TDD. Tick only what the team needs beyond that: every member inherits it. A skill's name opens its file in a drawer, drawn as a page: add it, **clone it** into the
   team (or into a member, once you have them) to change it, or **Edit** a copy. **New skill** opens the skills
   editor: a name, a description (what it does and when to use it), a kind, tags, Spanish texts if you want them,
   and the markdown the agent follows, with its preview beside it.
3. **Suggested members**: for each role, the employees whose profile fits the purpose and skills, with why (the
   skill, the headline or the experience that matched). Add the ones you like, skip the rest.
4. **The roster**: everyone, filtered by role, temperament, gender, skill and words. Choose several at once, any
   number per role. The list of the chosen counts each role and flags a role the stations need that has nobody: a
   team runs when each of them has a member.
5. **Who works each member**: an agent (the first this machine has, Claude Code by default), local or an API, the provider
   and the model: an agent that is not installed, or an API without a key, shows why and cannot be chosen. The model
   list is the provider's own: Claude Code's models, OpenCode's, an API's; **Other model…** lets you type one where
   the provider takes any. **Local** is OpenCode on the models Ollama has on this machine, free: install OpenCode and
   Ollama, pull a model (`ollama pull qwen2.5-coder:7b`), and it is listed with the memory it needs. A member an older
   team file left to the Nuclear Developer (on standby, ADR-platform-0013) is converted to the default agent, and the
   page says so in a warning line.
   **The same for** gives everyone (or all the developers, all the QA…) one agent and model in one click: a member is
   their profile, not their model. Under each row, **Make them different** holds what makes that member themselves:
   their temperament (the employee's own unless you choose another), their characteristics, their instructions, the
   role's skills they use and skills of their own. A paid member wears a **PAID** badge; the step counts them and says
   it plainly: Claude Code, OpenCode, Codex… cost money per run; a run asks you twice before spending only for an API
   paid by use (an agent's subscription is not asked, unless `nuclear.spending.forceConfirm`), and the team's budget
   per run caps it. **Model for the whole team** (above *The same for*) gives the team one agent or API and its model,
   chosen once: every member says *Team's model*, and **Own model…** on a row gives that member its own, which wins;
   *None* leaves each member its own. Step 2 also holds the team's **Method** (Scrum by default, or *Our own method*
   written by you) and its **Instructions**, which the tech lead and every member follow. Choose the tech lead, then
   **Create team**.

Editing a team (**Members…**) reuses steps 4 and 5: add or remove members, change who works them and what makes each one different. The team's page shows only its
members, grouped by role: the roster's candidates appear only while you add (a role's **+ Add** opens them, **Done**
closes them). Nuclear Chat lists each team's tech lead, not every member: **Talk** on the tech lead opens its
conversation in Nuclear Atlas; on another member it is **Ask the tech lead**, the lead's conversation (the lead assigns
the work), and so is a member's face on the company screen; a team's **Channel** opens the team's channel.

Under the team's description, **How the team works**: the **Model for the whole team** (*None: each its own*, *Agent*
or *API*, the provider and the model: the pickers a member has, `team update --kind --provider --model`, or
`--no-brain`), with how many members inherit it; the **Method** (*Scrum (the default)*, or *Our own method* and its
text) and the **Instructions** every member follows, saved as you type. Each member's row and Overview say *Team's
model* or *Own model*; a member's Brain has *Team's model* first, to give its own up (`team member update
--team-brain`). The welcome's team step is the same wizard. The Builder's empty page and the team at the foot
of its log have **Build a team**, which opens this wizard straight away; the workspace's strip has *Your software
company* (three people, `Ctrl+Alt+E`).

A member opens beside the list. Its header says who they are and their **Brain**: pick one line, an agent and its
model together (*Claude Code · opus*, *Anthropic API · …*); a `$` line costs money, a grey one is not on this
machine and says why. The agent · model chip on a member's row opens it too. The tabs under it:
*Overview* (the brain, the cost and the team's budget, the teams they are in, tech lead, temperament, skills, what
they did last), *Person*, *Skills*, *Instructions*, *Behaviours*, *Tasks*, and last the fun *Profile*.

**Skills.** Under the team's description, **Team skills** holds what every member inherits: add more from the
library, or write a **New skill**. A member's *Skills* tab has the role's skills to switch on or off, a **base agent**
(an `agent.md` of the library: a backend, mobile or web engineer, a QA security tester, a tech writer; its text comes
before the member's instructions and its skills are added), and then every skill the member gets: their own first,
then the library's they added, then the team's, marked *inherited from the team*, then Nuclear's base, marked
*Nuclear base*. A member's own skill with the same
name as the team's wins over it, and the team's over the library's: clone one to make it theirs, then edit it.
Deleting one of your skills asks you first; the library's files never change.

Who works a station in a run: the member the tech lead assigns, else the first member of that role
(`nuclear-builder run … --assign developer=<member>`).

In a terminal or for an agent, the same steps are commands (`team name-suggest`, `team suggest`, `team create`,
`team member add|remove|update`, `team runnable`, `skills list|show|clone|create|update|delete`, `team skills set`: [teams-and-vault.md](../02-architecture/teams-and-vault.md)).
