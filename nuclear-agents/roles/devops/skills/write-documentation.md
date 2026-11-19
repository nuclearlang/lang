---
name: write-documentation
description: Write the documentation of the part of the project named in the spec.
title_es: Escribir la documentación
description_es: Escribir la documentación de la parte del proyecto que nombra la spec.
prompt: docs
---
# Use case: documentation

Write documentation for the part of the project named in the spec.

- Who reads it: a developer who knows the domain but not this code. Start with what it is for, then how to use it,
  then how it works inside. Short sentences, English, one idea per paragraph.
- Every Nuclear example must pass `nuclear_check`; show the Nuclear code, never the generated code, unless the
  page is about the generated code.
- Name the files and commands exactly as they are. Do not document plans or "pending" work: that goes in the roadmap of the project (`docs/01-product/roadmap.md`).
