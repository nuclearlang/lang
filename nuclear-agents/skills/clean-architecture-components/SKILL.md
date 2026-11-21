---
name: clean-architecture-components
description: Organise a Synapsis project into closed components with presentation, domain and data layers (facades, use cases, repositories, services, aggregates) as nuclear gen and nuclear help layout lay them out. Use when designing a feature's pieces, splitting a component or fixing N0301/N0302.
title: Clean architecture with components
title_es: Arquitectura limpia con componentes
description_es: Organizar un proyecto Synapsis en componentes cerrados con capas de presentación, dominio y datos: fachadas, casos de uso, repositorios, servicios y agregados, dispuestos por nuclear gen component, gen resource y nuclear help layout. Úsalo al diseñar las piezas de una función, dividir un componente o corregir errores N0301/N0302.
kind: practice
tags: [architecture, clean architecture, components, layers, use case, repository, facade, design]
base: true
---
# Clean architecture with components

## When to use

Designing where a feature's pieces go, splitting a component that grew, or fixing N0301/N0302. Synapsis has a light
clean architecture on its three platforms: closed components, each with data, domain and presentation (or api)
layers, and only the business logic written in Nuclear.

## Steps

1. **See the layout**: `nuclear help layout --platform backend|mobile|web` prints where each kind's file goes.
   Backend: `components/<c>/data/entities/`, `data/repositories/`, `domain/models/`, `domain/usecases/`,
   `domain/services/`, `domain/aggregates/`, `api/` (controllers), `events/` (listeners), `ai/`. Mobile and web:
   `data/` (repositories), `domain/models/`, `domain/usecases/`, `presentation/<screen>/` with `managers/` and
   `state_models/`. Shared pieces in `shared/`; app configuration in `config/project_config.nuc`.
2. **One component per business capability** (orders, payments, catalog), not per technical layer. Create it with
   `nuclear gen component <component>` (its facade and config), or let `nuclear gen resource` create it.
3. **Place each piece by its job**:
   - `repository`: the data of one entity or one API; queries only;
   - `usecase`: one business operation, one `exec` returning `Result`; the rules live here;
   - `service`: helpers several use cases share (mapping, calculations without state);
   - `aggregate`: rules several use cases share that compose repositories or services (a cart with its totals);
   - `appcomponent`: the facade, one alias per use case (`create() = CreateTask.exec`);
   - backend `controller`: routes calling the facade; mobile/web `statemanager`: states from the facade; views
     show states.
4. **Generate, do not lay out by hand**: `nuclear gen resource` writes models, repository, use cases, facade aliases
   and the controller or screen at their places; `nuclear make <kind> <component> <Name>` (backend, web) or the
   mobile `nuclear make usecase|repository|service|aggregate <component> <name>` for the rest;
   `nuclear gen usecase` wires a use case into the facade (and a route on the backend).
5. **Respect the dependency rules** (checked by `nuclear check`): a use case is used only from the facade (N0301); a
   service only from a use case or an aggregate; an aggregate only from a use case; a repository only from a use
   case or an aggregate (or a `tools` on the backend). From another component only its facade and its public kinds
   are visible (N0302): backend `appcomponent`, `model`, `entity`, `tools`, `agent`, `state`, `graph`; mobile and web
   the `appcomponent`, models, events, global components, guards and screens.
6. **Cross-component work** goes through facades or events: component A calls `B`'s facade, or publishes an event
   (`~publish` on the backend, `Events.publish` on mobile and web) that B listens to.
7. **Dependencies are typed parameters of the header**, injected by type: never construct a repository or a
   connection by hand.
8. `nuclear check . --json` must print `[]`; `nuclear test`.

## The platform's tools

- `nuclear help layout --platform <p>`, `nuclear gen component`, `nuclear gen resource`, `nuclear gen usecase`,
  `nuclear make <kind> ...`, `nuclear gen inspect`.
- Diagnostics N0301 and N0302 (`nuclear help diagnostics`) with the allowed callers in the message.
- `nuclear fix .` applies the exact fixes the check proposes.

## Pitfalls

- Interfaces or classes that only pass data around: the layers exist in the generated code; in Nuclear you do not
  write them.
- Rules in a controller, a view or a state manager: move them into a use case.
- A "utils" or "common" component everyone calls: put shared models in `shared/`, shared logic in a service of its
  owning component, and cross-component calls through facades.
- One component reaching into another's repository to save a step: N0302, and the coupling the rule prevents.
- `test/` may use any declaration: do not copy a test's shortcut into production code.
- Moving files by hand between components: the kind follows the folder; re-run `nuclear check` after any move.

## Checklist

- [ ] Each component maps to one business capability and has its facade.
- [ ] Every file sits where `nuclear help layout --platform <p>` says its kind goes.
- [ ] Rules live in use cases (or services/aggregates they call), never in controllers or views.
- [ ] Other components use only the facade and the public kinds; no N0301/N0302.
- [ ] Standard pieces came from `gen`/`make`, not written by hand.
- [ ] `nuclear check . --json` prints `[]` and `nuclear test` is green.
