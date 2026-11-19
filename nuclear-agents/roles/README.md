# The roles of the software factory

Every spec goes through six stations, each owned by a role (spec 011, ADR-platform-0005). A role is a folder of
files, the one source of what the role is: the local agents of the [Nuclear Developer](../nuclear_developer/AGENTS.md),
a provider's agent (Claude Code, Codex, Gemini CLI, OpenCode) and a provider's model through an API all read the
same files (ADR-developer-0002). Nothing of a role is repeated in code.

| # | Station (`id`) | Role | Folder |
|---|---|---|---|
| 1 | Analysis (`analysis`) | Analyst | [`analyst/`](analyst/role.md) |
| 2 | Design (`design`) | Architect | [`architect/`](architect/role.md) |
| 3 | Tests first (`tests`) | Developer | [`developer/`](developer/role.md) |
| 4 | Code (`code`) | Developer | [`developer/`](developer/role.md) |
| 5 | Quality (`quality`) | QA | [`qa/`](qa/role.md) |
| 6 | Delivery (`delivery`) | DevOps | [`devops/`](devops/role.md) |

DevOps (`devops`) is the infrastructure (CI/CD, deployments and environments, containers, monitoring, secrets) and
the delivery (the definition of done, the documents, the user stories, the pull request after the user's approval,
never a merge). Its role id was `delivery` before spec 011's amendment: the engine reads that id as `devops` in a
team, a run and a command (`roles.nuc`'s `OLD_ROLES`), and its employees keep their ids (`del-NNN`).

## A role's folder

| File | What it is |
|---|---|
| `role.md` | front matter `id`, `title`, `stations`, `default` (the default assignment: `kind`, `provider`, `model`); the body: Mission, Inputs, Outputs, Definition of done, Never, Skills |
| `skills/*.md` | the how-tos the role may use; front matter `name`, `description`, `title_es` and `description_es` (below), and `prompt` when the skill is a prompt the Smart Graph serves |
| `templates/*.md` | the documents its stations write in the spec's folder (`specs/<id>/`); `{{name}}` is filled by the engine or the agent |
| `checks.toml` | the checks it proposes: `[[check]]` with `id`, `title`, `title_es`, `station`, `on`, `by` (`role` or `user`), and a `command` (a key of the `commands` of `.nuclear/builder.json`) or a `prompt` |
| `roster/en.json`, `roster/es.json` | the 40 employees the user can hire for the role: `role`, `stats` (the six stat names, once), `employees` (below); the same ids, genders, temperaments, years, recommenders and numbers in both languages, English the source |
| `roster/faces/<id>.webp` | each employee's portrait, painted by `faces.nuc` (below); never edited by hand |
| `roster/faces/thumb/<id>.webp` | its thumbnail, 128 × 128 WebP of quality 70 (about 3 KB), made by `faces.nuc` from the portrait: what the editors' tiles, cards, rows and chat avatars draw |
| `roster/faces/faces.json` | the prompt and seed of every portrait of the role, so one can be painted again |

`role.md` names every skill and template of its folder; `nuclear_developer/test/roles_test.nuc` checks that every
folder is complete, every file named exists and every file is named, and that each prompt of the graph is given once.
A team (the user's, `~/.config/nuclearlang/factory/teams/<id>.json`) switches skills on and adds instructions; it
never changes these files.

## Localization

English is the source; what the screens read has its Spanish **beside its English, in the same file**, as the field's
name with `_es`:

- a skill a member can switch on: `title_es` and `description_es` in its front matter (the English title is the
  skill's name in words). A prompt of a local agent's step (`prompt: agent.<step>`) is never shown and has none;
- a check: `title_es` in `checks.toml`;
- the rosters are whole files per language (`roster/en.json`, `roster/es.json`) and the temperaments carry
  `name` and `description` as `{ en, es }`: they were made per language from the start.

`nuclear-builder team roster --lang es` gives each skill's `skillTexts` in that language; a run's checks keep the
`title_es` and the screens show the one of their language. The text a model reads (a skill's body, a check's prompt,
a temperament's `voice`) stays English. `tests/test_roster.nuc` fails when a skill or a check the screens show has no
Spanish.

## The prompts of the local agents

A skill whose front matter has `prompt:` is a prompt of the Smart Graph: `nuclear-graph ingest` puts the text after
its front matter in the graph's `prompts` collection, served by `GET /v1/prompts/<prompt>` (the Developer's
`Workbench`, the MCP server's `graph_prompt`). Two kinds:

- **A use case** (`prompt: feature`): the validated guide of a kind of work, for a frontier model or as the
  `{{guide}}` of a step.
- **An agent's step** (`prompt: agent.<step>`, the files `skills/step-<step>.md`): the whole prompt one step of a
  Nuclear Developer agent sends to its model. `{{name}}` is filled by the agent (`Workbench.prompt`); a `## `
  section all of whose values are empty is dropped whole, with the words written around them, so a prompt never shows
  an empty heading nor says what to do with rows it lacks.

| Prompt | Skill | Agent · step | Model |
|---|---|---|---|
| `agent.piece` | `developer/skills/step-piece.md` | coder and tester · write | coder |
| `agent.repair` | `developer/skills/step-repair.md` | coder and tester · repair with the compiler's errors | coder |
| `agent.faithful` | `developer/skills/step-faithful.md` | coder · the answer compiles but lacks a name, a path or a value the task writes | coder |
| `agent.test` | `developer/skills/step-test.md` | tester · what it answers | coder |
| `agent.analyze` | `analyst/skills/step-analyze.md` | analyst · the resources a request in plain words describes (each line is then tried with the generator's dry run) | default |
| `agent.chat` | `analyst/skills/step-chat.md` | assistant · answer a message of the chat (over the `chat` guide) | default |
| `agent.plan` | `architect/skills/step-plan.md` | planner · split the spec | default |
| `agent.plan-again` | `architect/skills/step-plan-again.md` | planner · the answer had no line in the form | default |
| `agent.security` | `qa/skills/step-security.md` | security reviewer · review | default |
| `agent.diagnose` | `qa/skills/step-diagnose.md` | diagnoser · why a step failed and what to do (kind and action decided by rules) | default |
| `agent.document` | `devops/skills/step-document.md` | documenter · write what the run did | default |
| `agent.accept` | `devops/skills/step-accept.md` | acceptor · each acceptance criterion met or not, with its evidence | default |

The use cases: `piece`, `test`, `feature`, `bug`, `refactor` (Developer), `plan`, `diagram` (Architect), `chat`
(Analyst), `security` (QA), `docs` (DevOps).

**A change to a skill that is a prompt is a change to an agent**: run `eval/run.py local` in
[`nuclear_developer`](../nuclear_developer/docs/06-runbooks/evaluation.md) and keep the report.

## An employee

`id`, `name`, `location`, `age` (a joke, read as years by `faces.nuc`), `university`, `profile` (the job title),
`bio`, `hrNote`; a profile as LinkedIn sums one up (spec 011 requirement 31): `headline` (one line), `connections`
(a text: `"500+"` or a joke), `experience` (two to four `{ company, title, years, line }`, the latest first; every
company invented), `education` (one or two `{ school, degree, years }`, the `university` among them), `skills`
(five to eight texts), `endorsements` (`{ <skill>: <count> }`, of the skills), `recommendations` (one or two
`{ from: <another employee's id, any role>, text }`, written in the recommender's temperament), `openTo` (a joke);
then `gender` (`female`, `male` or `nonbinary`, matching the name and the face), `temperament` and `stats`. The
humour is satire of software work, never about real people, companies or protected groups.

**The genders per role** (requirement 29): QA and DevOps mostly women (28 of 40 each, one nonbinary), the
Developer mostly men (28 of 40), the Analyst (23 women, 16 men, one nonbinary) and the Architect (20 and 20) mixed;
every roster has both.

## The faces and the temperaments

Every employee has a face and a temperament (spec 011 requirements 27 and 28), shown the same in every editor and in
Nuclear Chat.

- **`team-names.json`**: the word lists of the new-team wizard's *Suggest a name* (`nuclear-builder team
  name-suggest`), per language: `{ "en" | "es": { "patterns", "adj", "noun", "thing", "suffix" } }`. A pattern names
  lists in braces (`"The {adj} {noun} of {thing}"`), each filled at random; `{topic}` is a word of the team's purpose,
  and a pattern with it is used only when there is one. Satirical, a cyberpunk office's dark humour; a Spanish pattern
  agrees with its words (masculine plural nouns and adjectives).
- **`temperaments.json`**: the compendium of 25 workplace personalities, each `{ id, name: { en, es }, description:
  { en, es }, voice, look }`: `extrovert`, `introvert`, `shy`, `nerd`, `sarcastic`, `optimistic`, `grumpy`,
  `perfectionist`, `chaotic`, `formal`, `joker`, `arrogant`, `paranoid`, `passive-aggressive`, `burnt-out` (the
  burnt-out veteran), `micromanager`, `people-pleaser`, `know-it-all`, `workaholic`, `slacker`, `mentor`, `dramatic`
  (the drama queen), `conspiracist`, `zen`, `overconfident` (the overconfident junior). The `description` is one
  sentence for people (the screens); the `voice` is the text a member's prompt carries (how long they write, their
  tone, their emoji and GIFs, and that the temperament never changes what is true); the `look` is how the portrait
  shows it (expression, pose, styling). Each employee's `temperament` fits their bio; a team may give a member
  another one (`personality.temperament` of the team file).
- **The faces**: a painted, lifelike cyberpunk bust portrait per employee, 512 × 512 WebP of quality 80 (20 to 40
  KB), made on the developer's machine by an image model and checked in: nobody needs the model to use them.
  `faces.nuc` (this folder is a small Nuclear project, `python` dialect, `nuclear.toml`) writes each employee's
  prompt from the card (the role's neon as the rim light, the gender, the age the card says or one the dice pick,
  the temperament's `look`, a detail of the bio such as a coffee cup) and a style shared by the whole set; the dice
  (a seed from the id) pick the origin, the hair, two implants and the jacket. It runs the model once per employee
  (a process), converts its PNG with ImageMagick (`magick`), and records the prompt and seed in
  `roster/faces/faces.json`. It skips the faces already made, so a stopped run goes on where it was. Then it makes
  each face's thumbnail (`roster/faces/thumb/<id>.webp`: `magick -resize 128x128 -quality 70`) where there is none or
  the face is newer; `--thumbs` makes only the thumbnails, from the portraits already there, without the model. The
  editors draw the thumbnails everywhere but the open profile (the 200 portraits are some 7 MB, their thumbnails
  about 550 KB).

### The tool and the model (outside the repository)

[stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) (MIT) with its Vulkan build, and
**FLUX.1-schnell** (Apache-2.0: its images may ship in an open-source repository) as GGUF, in
`~/.local/share/nuclear-image-models/` (another folder: `NUCLEAR_IMAGE_MODELS`; never under `share/nuclearlang/`, which
every `installer/install.sh` writes anew). Never a model with a
non-commercial or research licence (no FLUX.1-dev, no SDXL-Turbo). The weights are never committed.

```sh
D=~/.local/share/nuclear-image-models; mkdir -p $D/sd $D/models
cd $D/sd && gh release download -R leejet/stable-diffusion.cpp -p '*Linux-Ubuntu-*-x86_64-vulkan.zip' && unzip *.zip
cd $D/models && H=https://huggingface.co
curl -LO $H/city96/FLUX.1-schnell-gguf/resolve/main/flux1-schnell-Q8_0.gguf
curl -LO $H/city96/t5-v1_1-xxl-encoder-gguf/resolve/main/t5-v1_1-xxl-encoder-Q8_0.gguf
curl -LO $H/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors
curl -LO $H/second-state/FLUX.1-schnell-GGUF/resolve/main/ae.safetensors   # FLUX's autoencoder, Apache-2.0, not gated
$D/sd/sd-cli --list-devices                                                 # Vulkan0 must be listed
```

It runs 4 steps of Euler without guidance (FLUX.1-schnell's; the negative prompt kept in `faces.json` is not read
by it), the diffusion model on the GPU and the text encoder on the processor. On an AMD Radeon 890M (integrated,
Vulkan, 28 GB of shared memory) one face takes 30 to 70 s, the first one about two minutes (the 200 in about two and a half hours).

```sh
nuclear check . --json && nuclear build .                         # the generator and its tests, into build/
cd build && python3 -c "from nuclear_roles.faces import main; main()"                      # the faces not yet made
python3 -c "from nuclear_roles.faces import main; main(['--only', 'dev-003', '--seed', '7'])"  # one again, another seed
python3 -c "from nuclear_roles.faces import main; main(['--force'])"                        # all again (after a prompt change)
python3 -c "from nuclear_roles.faces import main; main(['--thumbs'])"                       # only the thumbnails (no model)
cd .. && python3 -m pytest -q && (cd build && npx -y pyright nuclear_roles)   # the checks below; their types
nuclear fmt --check .
```

`--only <id>` remakes one face with the seed `faces.json` keeps (or `--seed <n>`, a new one, then kept); a change
to the prompts takes `--force`, or `--only` for the faces it concerns. Look at every new face before it is checked
in: broken anatomy, text, a cartoon look or a face that does not match the gender or the temperament is made again.

`tests/test_roster.nuc` checks that the compendium has its temperaments with both names, a description, a voice and
a look; that every employee has a gender and a valid temperament (the same in both languages) and the profile's
fields, recommended by employees who exist; the spread of the genders per role; that every face is a WebP of at most
100 KB with its seed and prompt in `faces.json` and a thumbnail, a WebP of at most 10 KB, and no drawn face is left; and that a prompt is the same each time.
