---
status: accepted
owner: Julian Molina
updated: 2026-11-18
related: [write-a-spec.md, ask-the-team.md, ../02-architecture/teams-and-vault.md, ../../../../../docs/03-adr/0010-a-team-is-its-members.md]
---
# Make a team

A team is the people you hire from the roster, as many per role as you want: twenty developers if you need them.
Each member is worked by the local agents on this machine, by a provider's agent (Claude Code, OpenCode, Codex,
Gemini CLI, Cursor, Grok Build) or by an API model. Open *Your software company* (the Builder's *Team…*, or *Settings and integrations* →
Nuclear Builder) and press **New team**: five steps, *Next, Next*.

1. **Identity**: a logo (pick an image; it shows in the hexagon), the name (the die, *Suggest a name*, rolls a new
   one each time, like a game's nickname) and a description.
2. **Purpose and skills**: what the team is for, and the skills it needs from the **library**: real `SKILL.md` files
   (payments, bank accounts, authentication, offline sync, the Synapsis backend, mobile and web, TDD, an OWASP
   review…), grouped as domains, technologies and practices, with a search. Tick the ones the team needs: every
   member inherits them. A skill's name opens its file in a drawer, drawn as a page: add it, **clone it** into the
   team (or into a member, once you have them) to change it, or **Edit** a copy. **New skill** opens the skills
   editor: a name, a description (what it does and when to use it), a kind, tags, Spanish texts if you want them,
   and the markdown the agent follows, with its preview beside it.
3. **Suggested members**: for each role, the employees whose profile fits the purpose and skills, with why (the
   skill, the headline or the experience that matched). Add the ones you like, skip the rest.
4. **The roster**: everyone, filtered by role, temperament, gender, skill and words. Choose several at once, any
   number per role. The list of the chosen counts each role and flags a role the stations need that has nobody: a
   team runs when each of them has a member.
5. **Who works each member**: local (the default), an agent or an API, the provider and the model, from what this
   machine has: an agent that is not installed, or an API without a key, shows why and cannot be chosen. The model
   list is the provider's own: every model Ollama has installed (and a few small ones to download), Claude Code's
   models, OpenCode's, an API's; **Other model…** lets you type one where the provider takes any. Next to each local
   model is the memory it needs: one that is tight for what is free now is amber, and one too big for this computer
   is **red**: choosing it asks you first, and a red line stays under the member while it is chosen, because it can
   make the computer freeze or restart.
   **The same for** gives everyone (or all the developers, all the QA…) one agent and model in one click: a member is
   their profile, not their model. Under each row, **Make them different** holds what makes that member themselves:
   their temperament (the employee's own unless you choose another), their characteristics, their instructions, the
   role's skills they use and skills of their own. A paid member wears a **PAID** badge; the step counts them and says
   it plainly: Claude Code, OpenCode, Codex… cost money per run, each run asks you twice before spending, and the
   team's budget per run caps it. Choose the tech lead, then **Create team**.

Editing a team (**Members…**) reuses steps 4 and 5: add or remove members, change who works them and what makes each one different. The team's page shows its
members grouped by role. The welcome's team step is the same wizard. The Builder's empty page and the team at the foot
of its log have **Build a team**, which opens this wizard straight away; the workspace's strip has *Your software
company* (three people, `Ctrl+Alt+E`).

A member opens beside the list. Its header says who they are and their **Brain**: pick one line, an agent and its
model together (*Claude Code · opus*, *Nuclear Developer (local) · qwen2.5-coder:3b*); a `$` line costs money, a grey
one is not on this machine and says why; a red line is a local model too big for this computer (asked before it is
chosen). The agent · model chip on a member's row opens it too. The tabs under it:
*Overview* (the brain, the cost and the team's budget, the teams they are in, tech lead, temperament, skills, what
they did last), *Person*, *Skills*, *Instructions*, *Behaviours*, *Tasks*, and last the fun *Profile*.

**Skills.** Under the team's description, **Team skills** holds what every member inherits: add more from the
library, or write a **New skill**. A member's *Skills* tab has the role's skills to switch on or off, a **base agent**
(an `agent.md` of the library: a backend, mobile or web engineer, a QA security tester, a tech writer; its text comes
before the member's instructions and its skills are added), and then every skill the member gets: their own first,
then the library's they added, then the team's, marked *inherited from the team*. A member's own skill with the same
name as the team's wins over it, and the team's over the library's: clone one to make it theirs, then edit it.
Deleting one of your skills asks you first; the library's files never change.

Who works a station in a run: the member the tech lead assigns, else the first member of that role
(`nuclear-builder run … --assign developer=<member>`).

In a terminal or for an agent, the same steps are commands (`team name-suggest`, `team suggest`, `team create`,
`team member add|remove|update`, `team runnable`, `skills list|show|clone|create|update|delete`, `team skills set`: [teams-and-vault.md](../02-architecture/teams-and-vault.md)).
