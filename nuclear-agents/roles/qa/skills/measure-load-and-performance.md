---
name: measure-load-and-performance
description: Plan load and performance checks with their numbers and tools, run on the user's machine only with the user's approval.
title_es: Medir carga y rendimiento
description_es: Planificar comprobaciones de carga y rendimiento con sus números y herramientas, que corren en la máquina del usuario solo con su aprobación.
---
# Measure load and performance

1. Take the numbers from the analysis (requests a second, users at once, answer time, data size). Without a
   number, propose one as a question; never measure against "fast".
2. Choose what to measure: the answer time of each new route (median and 95th percentile), the throughput at the
   target load, the memory, the size of what is sent, the time of a screen to show its data.
3. Give each check its tool and its command, its data (how many rows are seeded first) and its threshold, and say
   on what it runs: the user's machine, a local build (`nuclear build .`), never a shared or production service.
4. Load tests are `by = "user"` or off by default: the user approves and starts them; QA reads their output.
5. In the report, give the numbers measured against the threshold, and the slowest step when one fails.
