"""The app: opens the connections of the configuration, mounts the controllers and starts the listeners."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import AppConfig, ComponentConfig, Connection
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
    # what `python -m synapsis.migrate` reads to find the database
    app.state.synapsis_config = config
    app.state.synapsis_components = components

    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, e: RequestValidationError) -> JSONResponse:
        # the platform's answer to an invalid body or parameter: 400 with the reasons (FastAPI's default is 422)
        return JSONResponse(status_code=400, content={"detail": jsonable_encoder(e.errors())})

    routers = [router_of(inject(cast(type[Any], c))) for c in controllers]
    for r in routers:
        app.include_router(r, dependencies=every)
    # the routes as mounted, for the connections that hook into them (telemetry reads @untraced)
    app.state.synapsis_routes = [route for r in routers for route in r.routes]
    for c in [*config.connections, *(c for comp in components for c in comp.connections)]:
        c.instrument(app)
    _serve_contract(app, every)
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


async def start(config: AppConfig, components: Sequence[type[ComponentConfig]] = ()) -> None:
    """Opens every connection (also used by tests and scripts without HTTP)."""
    for c in [*config.connections, *(c for comp in components for c in comp.connections)]:
        await c.open()
        _open.append(c)


async def stop() -> None:
    for c in reversed(_open):
        await c.close()
    _open.clear()
