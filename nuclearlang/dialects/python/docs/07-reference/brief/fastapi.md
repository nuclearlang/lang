# Dialect `fastapi`: the backend platform in Python

What this dialect adds to the platform's sheet: the project is generated as FastAPI + SQLAlchemy 2 async + pydantic +
LangGraph in `build/` (never edit it). `nuclear build`, `nuclear install` (a virtualenv), `nuclear run`
(`python -m synapsis.server`, uvicorn underneath), `nuclear test` (pytest), `nuclear migrate` (Alembic). Names are written in snake_case underneath; the
`.nuc` keeps camelCase and the compiler's messages use it. Full rules: `nuclear help fastapi`.
