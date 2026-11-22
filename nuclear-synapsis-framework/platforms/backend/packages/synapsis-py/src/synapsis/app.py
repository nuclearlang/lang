"""The app: opens the connections of the configuration, mounts the controllers and starts the listeners."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import AppConfig, ComponentConfig, Connection
from .errors import error_body, reasons_of
from .inject import inject
from .web import guarded, router_of

__all__ = ["create_app", "connection", "connections"]

_open: list[Connection] = []


def connections() -> list[Connection]:
    """The open connections."""
    return list(_open)


def connection[C: Connection](kind: type[C], name: str = "default") -> C:
    """The open connection of that type and name: connection(Database), connection(Redis, "cache")."""
    for c in _open:
        if isinstance(c, kind) and c.name == name:
            return c
    for c in _open:
        if isinstance(c, kind) and name == "default":
            return c
    raise LookupError(f"no {kind.__name__} connection named '{name}' in the configuration")


def create_app(
    config: AppConfig,
    components: Sequence[type[ComponentConfig]] = (),
    controllers: Sequence[type] = (),
    listeners: Sequence[type] = (),
    title: str = "app",
    entities: Sequence[type] = (),
) -> FastAPI:
    """The FastAPI app of the project (main.py calls it with every declaration). `entities`: the project's tables,
    listed so every one is imported before the relations between them are resolved."""
    del entities

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await start(config, components)
        from .events import consume

        # a listener receives the events of this process once it exists; `consume` adds Kafka when it is configured
        tasks = [asyncio.create_task(consume(inject(cast(type[Any], l)))) for l in listeners]
        try:
            yield
        finally:
            for t in tasks:
                t.cancel()
            await stop()

    # the app's guards check every route (ADR-synapsis-0007); a guarded app does not serve its documentation pages
    guards = list(getattr(config, "guards", []))
    hidden: dict[str, Any] = {"docs_url": None, "redoc_url": None, "openapi_url": None} if guards else {}
    app = FastAPI(title=title, lifespan=lifespan, **hidden)
    every = [guarded(guards)] if guards else None
    origins = list(getattr(config, "origins", []))
    if origins:
        from fastapi.middleware.cors import CORSMiddleware

        app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])
    # what `python -m synapsis.migrate` reads to find the database
    app.state.synapsis_config = config
    app.state.synapsis_components = components

    # every error answers Nuclear's body, whatever the framework would write (ADR-synapsis-0013)
    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, e: RequestValidationError) -> JSONResponse:
        # an invalid body or parameter: 400 with one reason per field (FastAPI's default is 422)
        return JSONResponse(status_code=400, content=error_body(400, "invalid", reasons_of(e.errors())))

    @app.exception_handler(StarletteHTTPException)
    async def refused(_: Request, e: StarletteHTTPException) -> JSONResponse:
        # a Result's error, a guard's refusal, a route that does not exist
        known = {404: "not found", 405: "method not allowed"}
        said = e.detail if isinstance(e.detail, str) else ""
        message = known.get(e.status_code, said) if said in ("Not Found", "Method Not Allowed", "") else said
        return JSONResponse(status_code=e.status_code, content=error_body(e.status_code, message or "error"), headers=e.headers)

    @app.exception_handler(Exception)
    async def failed(_: Request, e: Exception) -> JSONResponse:
        # what nothing handled: never the reason, which may hold what the app must not show
        return JSONResponse(status_code=500, content=error_body(500, "error"))

    routers = [router_of(inject(cast(type[Any], c))) for c in controllers]
    for r in routers:
        app.include_router(r, dependencies=every)
    # the routes as mounted, for the connections that hook into them (telemetry reads @untraced)
    app.state.synapsis_routes = [route for r in routers for route in r.routes]
    for c in [*config.connections, *(c for comp in components for c in comp.connections)]:
        c.instrument(app)
    _serve_contract(app, every)
    _own_openapi(app)
    return app


def _serve_contract(app: FastAPI, guards: Any = None) -> None:
    """GET /.nuclear/contract.json and /.nuclear/openapi.json: what the transpiler wrote next to the app (ADR-synapsis-0006),
    so a client project (`contracts(name = "https://...")`) and the editors' HTTP tools read the API as built."""
    for name in ("contract", "openapi"):
        path = Path(".nuclear") / f"{name}.json"
        if not path.is_file():
            continue

        def read(p: Path = path) -> JSONResponse:
            return JSONResponse(content=json.loads(p.read_text()))

        app.add_api_route(f"/.nuclear/{name}.json", read, methods=["GET"], include_in_schema=False, dependencies=guards)


def _own_openapi(app: FastAPI) -> None:
    """`/openapi.json` and the documentation pages show the document the transpiler wrote from the Nuclear
    (`.nuclear/openapi.json`), never the one the framework would work out from the generated code: the API is
    described once, the same in every dialect (ADR-synapsis-0013)."""
    path = Path(".nuclear") / "openapi.json"
    if path.is_file():
        app.openapi = lambda: json.loads(path.read_text())  # type: ignore[method-assign]


async def start(config: AppConfig, components: Sequence[type[ComponentConfig]] = ()) -> None:
    """Opens every connection (also used by tests and scripts without HTTP)."""
    for c in [*config.connections, *(c for comp in components for c in comp.connections)]:
        await c.open()
        _open.append(c)


async def stop() -> None:
    for c in reversed(_open):
        await c.close()
    _open.clear()
