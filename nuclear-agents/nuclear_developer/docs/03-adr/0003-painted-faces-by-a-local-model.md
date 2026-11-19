---
status: accepted
date: 2026-11-18
deciders: Julian Molina
---
# ADR-developer-0003: The roster's faces are painted by a local image model, not drawn as SVG

## Context and problem
Every employee of the roster (`nuclear-agents/roles/<role>/roster/`, 200 people) has a portrait shown on the
diagram, the company screen, the log and in Nuclear Chat (spec 011 requirement 27). The first faces were SVG drawn by
a generator in Nuclear from each employee's card: deterministic and tiny, but the user rejected them as cartoons.
The look wanted is a painted, lifelike cyberpunk portrait like a concept artist's: real skin and light, a neon city
behind, implants, visors, strong character. No hand-written drawing code reaches that, and the platform pays for no
image service.

## Decision
The faces are painted on the developer's machine by an image model: **FLUX.1-schnell** (Apache-2.0) as GGUF, run by
**stable-diffusion.cpp** (MIT) with its Vulkan backend, so it runs on any GPU the machine has (an integrated AMD one
included) without CUDA nor PyTorch. The orchestration stays in Nuclear (`roles/faces.nuc`): it writes each
employee's prompt from the card and the temperament's `look`, picks a fixed seed from the id, runs the model as a
process and keeps the prompt and seed in `roster/faces/faces.json`. The images (512 px WebP) are checked in; the
model and the tool live outside the repository and are only the developer's tool for making them.

FLUX.1-schnell because its licence lets its images ship in an open-source repository, it paints a good face in four
steps (under a minute on an integrated GPU), and stable-diffusion.cpp runs it quantized in the memory of a laptop.

## Options considered
1. SVG drawn by a Nuclear generator (the first version): deterministic and small, but it looks like a cartoon.
2. A paid image service: against the platform's rule of no paid service for what the machine can do.
3. Other local models: SDXL-Turbo and FLUX.1-dev have non-commercial licences; Stable Diffusion 1.5/SDXL need many
   more steps and look worse at faces.
4. FLUX.1-schnell with stable-diffusion.cpp (chosen).

## Consequences
- Positive: portraits of the quality the user asked for, made on the machine, free, licensed for the repository;
  any face can be made again from its prompt and seed.
- Negative: an image is not reproducible bit for bit across machines or versions of the tool, so the tests check
  that every face exists, is a WebP and has its prompt and seed, not that it equals the generator's output; 200 faces
  take about three hours, and each new or changed face must be looked at before it is checked in; the faces weigh
  about 6 MB in the repository.

## References
- Spec 011 requirements 27, 28, 29; `nuclear-agents/roles/README.md`, "The faces and the temperaments".
