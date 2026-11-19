---
status: accepted
owner: Julian Molina
updated: 2026-11-17
related: [vision.md, ../02-architecture/engine.md, ../02-architecture/teams-and-vault.md, ../08-guides/follow-a-run.md]
---
# Domain: spec, run, station, role, team

The Builder is the software factory of spec 011: one engine, written in Nuclear (`factory.nuc`, `run.nuc`), run by
the editors and the terminal as the `nuclear-builder` process.

## The words

| Term | Meaning | In the code / on disk |
|---|---|---|
| Spec | What is asked: a title, a use case, a description, the acceptance criteria, optional context files, pieces and strategy | `specs/<component>/[<layer>/]<id>/spec.md` (`_global/<id>/` for the whole project) |
| Use case | The kind of work the form offers: a feature, a refactor, a bug, tests, a security review, documentation, a diagram | `- Use case:` of the spec |
| Run | One execution of a spec through the line | `.nuclear/builder/runs/<id>.json` (`engine: 3`) |
| Station | One of the six steps of the line: `analysis`, `design`, `tests`, `code`, `quality`, `delivery`; a stage of the run file | `STATIONS` (`roles.nuc`), `STATION_INFO` (`run.nuc`) |
| Role | Who works a station: Analyst, Architect, Developer, QA, DevOps (the Delivery station's; its id was `delivery`, read as `devops`); a folder of `nuclear-agents/roles/` | `STATION_ROLE`, `roles.nuc` |
| Team | The members the user hired, any number per role, one of them the tech lead; its name, logo, description, purpose, skills and the run's budget; made with the new-team wizard (`team create`), never from a preset; it runs when each role the stations need has a member | `~/.config/nuclearlang/factory/teams/<id>.json` (the logo `<id>.logo.<kind>` beside it) |
| Tech lead | The member who answers for the team in Nuclear Chat: speaks for everyone, says who owns a question, is accountable for the team's work; may assign who works a station in a run; the first Architect unless the team names another member | `techLead` of the team file (a member's id) |
| Member | An employee of the roster hired into a team in one role, with an id unique in the team and who works them (local, an agent, an API: provider and model), skills, instructions, behaviours, tasks; in Nuclear Chat a person: a name (the employee's by default), the roster's profile, a personality (how often a GIF, at which moments, a note), a responder; a station is worked by the member the tech lead assigned, else the role's first | `nuclear-builder member`, `chat-host` (`member.nuc`) |
| Provider | What does a role's work: the Nuclear Developer (local), an agent's command line, an API model; one adapter each | `adapter*.nuc`, `api_*.nuc` |
| Lead | The role that takes what the local Developer could not finish: the Architect, when its member is not local and the Developer's is | `engine.md` |
| Step | One thing one role (or the shell, or a local agent of the Developer) did inside a station, with its trace, input, output, code and decisions; it names the role, the employee, the provider and the model | a step of the run file |
| Gate | A stop for the user after a station: approve, ask for a change, stop | `.nuclear/builder.json` `gates` |
| Component, layer | Where a spec belongs: a business component of the project (`components/<name>/`), and the layer it touches (`presentation`, `domain`, `data`); `_global` for the whole project | `specs/<component>/[<layer>/]<id>/` |
| General agent | Atlas, the member of every project's chat with no team (`--role chat`): worked by the provider of `nuclear.builder.chat`, writing through the factory's tools; its direct message is Nuclear Atlas's page | `nuclear-builder member --role chat`; its spending in `.nuclear/builder/chat/member-…jsonl` |
| Draft | A member's new text of a spec (`spec_draft`), beside it as `spec.draft.md` until the user accepts or discards it | `nuclear-builder spec accept|discard` |
| Check | One item of the run's list: a role's or the user's, by a command or a prompt; QA's plan stops for the user's | `checks.json` in the spec's folder |
| Piece | One file to write, with its task | the plan; `## Pieces` of a spec |
| Strategy | The kind of request and the plan of that kind; it decides the stations that run | `run.analysis`; `- Strategy:` of the spec |
| Journal | The readable record of a run | `.nuclear/builder/runs/<id>.md` |
| Ledger | Every file a run wrote, with what was there before | `writes` of the run file |
| Project map | Every declaration of the project with its kind, description and members, written by the transpiler | `.nuclear/map.md` |
| Line settings | The commands, the gates, the stations that run | `.nuclear/builder.json` |

## The stations, in order

Analysis → Design → Tests first → Code → Quality → Delivery. The analysis names the strategy; a strategy may leave
stations out (each one says why). Artifacts and deploy are commands of the line (`nuclear-builder ci`), not stations.

## Who works

| Who | Does | Does not |
|---|---|---|
| You | write the spec, choose the team, answer the gates, run and mark your checks, approve the delivery | write a piece here |
| Analyst | reads the spec as the client's request, makes the criteria checkable, asks what is missing | design or build |
| Architect | designs what the generators did not write, the plan of one-file pieces; the lead when the Developer is local | write every piece |
| Developer | the tests first, then the code; the local one (Nuclear Developer) through its planner, coder and tester on models of 3B at most | choose names, data or architecture |
| QA | the plan of checks (functional, non-functional, security, load), runs its own, writes the report | change the code |
| DevOps | the Delivery station: the definition of done, the user stories, the pull request after your approval; the CI, the deployments and environments, the containers, the monitoring, the secrets | merge, deploy to production or write a secret without you |
| Shell | runs the line's commands and the generators | run anything not in `.nuclear/builder.json` |

The local **analyst** picks the strategy, the local **diagnoser** tells why a station failed, the local
**documenter** writes the top of the journal.

## How the work is split

So that the local 3B models only think the business logic:

1. Before anyone writes, the transpiler has written the **project map**; the agents read it instead of every file.
2. **Design**: the generators write first what follows from the data (`nuclear gen resource`); the plan holds only
   what is left.
3. **Tests first**: one test per acceptance criterion, with the names the plan gives.
4. **Code**: each piece at its place, checked by the compiler, each use case wired by `nuclear gen usecase`; the
   errors left go back to the Developer, then to the lead.
5. **Quality**: every test runs; a failing test goes back told in Nuclear (`nuclear explain`), up to three rounds,
   then to the lead. A station run again runs its role's checks again.

## Invariants

- The local agents only ever see Nuclear and the platform (backend, mobile, web), never Python, TypeScript or Dart.
- A spec needs at least one acceptance criterion.
- Nothing is guessed: a request that lacks a fact its strategy needs stops at the analysis, with the question.
- A bug's repair goes to the file the failure names, whoever wrote it, and never to the test.
- Two processes never run the same run.
- A file the user changed since the run wrote it is never undone.
- No paid call without the two confirmations (or `--confirm-spending` where the project allows it), and never over
  the run's budget.
- Nothing is merged: DevOps opens a pull request, only after the user approves it.
