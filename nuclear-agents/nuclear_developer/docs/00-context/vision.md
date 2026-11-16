---
status: accepted
owner: Julian Molina
updated: 2026-11-16
related: [../02-architecture/overview.md, ../02-architecture/integrations.md, ../05-standards/testing.md]
---
# Vision

## Problem

A frontier model that does all the work of a spec is paid for every token, and the code leaves the machine. A model
small enough to run on a developer's laptop (at most 3B parameters) cannot hold much context, chooses tools badly,
and the machine has no GPU to train one.

The Nuclear Developer is a set of local agents for NuclearLang and Synapsis that work as **the junior developer of
a frontier model**: a lead (Claude, or the user) makes the decisions (the plan, the names, the review) and the
local developer writes each piece. What a small model cannot hold in its head comes from the
[Nuclear Smart Graph](../../../../nuclear-graph-storage/README.md); what it writes is checked by the Nuclear
compiler before it answers. What the junior cannot fix, the lead fixes and keeps as an example in the graph, so the
junior gets it right next time.

## Who uses it

- **The Builder** of the editors and `nuclear-builder`: a spec goes through plan, tests first, code, verification,
  security and artifacts with the local agents.
- **The chat** of the editor: a question about the project, or an order.
- **A frontier model** over MCP (Claude Code, Codex, Cursor): `developer_task` first, then it validates and
  corrects.

How each calls it: [integrations](../02-architecture/integrations.md#where-it-works).

## The idea behind the design

- **A small model follows fixed steps better than it chooses tools.** Each agent is a graph with fixed steps
  (recall, write, check, repair), never a model with a toolbox.
- **Tools before models.** A generator writes what is standard, the compiler's exact fixes come before any repair,
  a rename is done by a tool: a model writes only a piece of one file that no tool can write.
- **The agents are trained by retrieval and distillation**, not by changing weights: a failure is fixed with a
  general rule or more knowledge in the graph, never with the answer.

## What it does not do

- It does not choose names, data or architecture: the order gives them.
- It does not write a target language. The agents write only Nuclear: they name a platform (`backend`, `mobile`,
  `web`), never a dialect.
- It does not run a model larger than 3B parameters of effective size (the user's rule).
- Its assistant does not change a file: an order is a run of the Builder.
- It does not hide what is beyond it: the plan and the analysis say so before anything is written
  ([the limits](../02-architecture/overview.md#known-limits)).
