---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-0010: A team is the members the user hires, as many per role as they want

## Context and problem
ADR-platform-0005 made a team the five employees hired for the five roles, made from a preset (*Local only*,
*Claude leads*, *Providers only*). The user found it wrong: choosing *Providers only* cloned a team, who works each
member is set per member anyway, and a company hires twenty developers if it needs them.

## Decision
1. **A team is a list of members**, each an employee of the roster in one role, with who works them (local agents,
   a provider's agent, an API model), their model and settings. Any number per role; at least one of each role the
   line's stations need before the team can run. One of them is the tech lead.
2. **A new team is a wizard** (*Next, Next*): its identity (name — the system can suggest one, like a game's
   nickname —, a logo, the purpose and the skills it needs), then members suggested from that purpose and skills,
   then the user adds members from the roster with filters (role, temperament, gender, skills), several at once,
   then who works each one. The presets are gone as a way to make a team; what they set is a choice per member.
3. **Money is said where it is chosen**: each member put on a paid provider shows that it costs money, and the
   wizard's last step sums who is paid before saving; the runs keep their two confirmations.
4. **Who works a station**: the station's role's members; the tech lead assigns one (by default the first free one);
   the Developer's pieces may be split among several developers of the team.

5. **A member is its profile, not its model** (the user, 2026-11-18): the whole team may be worked by one agent
   and one model; what makes members different is what the user gives each one — instructions, skills, temperament,
   precise characteristics. The wizard makes both easy: one agent and model for everyone in one click, and each
   member's own instructions and skills.

This amends ADR-platform-0005 (the five hired employees and the presets).

## Consequences
- Positive: teams shaped like the user's real company; no preset to undo.
- Negative: the team file changes shape (old files are read and converted); the factory must choose a member per
  station.

## References
- Amends: ADR-platform-0005
- Spec: [011](../04-specs/011-software-factory/requirements.md), requirement 33
