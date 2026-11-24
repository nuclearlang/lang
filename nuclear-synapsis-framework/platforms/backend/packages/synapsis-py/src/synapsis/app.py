"""The app: opens the connections of the configuration, mounts the controllers and starts the listeners."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import AppConfig, ComponentConfig, Connection
from .edge import Edge, development
from .errors import IntegrityViolation, error_body, reasons_of
from .guards import refusal
from .inject import inject
from .web import guarded, router_of
from .wire import LIMITS, MAX_BODY_SIZE, MAX_PAGE_SIZE, Unreadable

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

    # the app's guards check every route (ADR-synapsis-0007); no app serves documentation pages (`/docs`): the API is
    # its OpenAPI document, which a guarded app does not serve either
    guards = list(getattr(config, "guards", []))
    hidden: dict[str, Any] = {"openapi_url": None} if guards else {}
    # a path is matched as it is written: `/tasks/` is not `/tasks` (404, never a redirect)
    app = FastAPI(title=title, lifespan=lifespan, docs_url=None, redoc_url=None, redirect_slashes=False, **hidden)
    every = [guarded(guards)] if guards else None
    # the limits of the configuration (the reference, §2.8), read by the Edge, the WebSocket and `paginate`
    LIMITS.body = int(getattr(config, "max_body_size", MAX_BODY_SIZE))
    LIMITS.page = int(getattr(config, "max_page_size", MAX_PAGE_SIZE))
    app.add_middleware(Edge, max_body_size=LIMITS.body, origins=list(getattr(config, "origins", [])), development=development())
    _quiet_server()
    # what `python -m synapsis.migrate` reads to find the database
    app.state.synapsis_config = config
    app.state.synapsis_components = components

    # every error answers Nuclear's body, whatever the framework would write (ADR-synapsis-0013)
    @app.exception_handler(RequestValidationError)
    async def invalid(_: Request, e: RequestValidationError) -> JSONResponse:
        # an invalid body or parameter: 400 with one reason per field (FastAPI's default is 422)
        return JSONResponse(status_code=400, content=error_body(400, "invalid", reasons_of(e.errors())))

    @app.exception_handler(StarletteHTTPException)
    async def refused(request: Request, e: StarletteHTTPException) -> JSONResponse | Response:
        # a Result's error, a guard's refusal, a route that does not exist, a body that cannot be read
        if isinstance(e.__cause__, Unreadable) or e.detail == "There was an error parsing the body":
            reasons = e.__cause__.reasons if isinstance(e.__cause__, Unreadable) else [{"field": "", "rule": "json", "message": "the body is not valid JSON"}]
            return JSONResponse(status_code=400, content=error_body(400, "invalid", reasons))
        if e.status_code == 405:
            return _not_allowed(app, request, guards)
        known = {404: "not found", 405: "method not allowed"}
        said = e.detail if isinstance(e.detail, str) else ""
        message = known.get(e.status_code, said) if said in ("Not Found", "Method Not Allowed", "") else said
        return JSONResponse(status_code=e.status_code, content=error_body(e.status_code, message or "error"), headers=e.headers)

    @app.exception_handler(IntegrityError)
    @app.exception_handler(IntegrityViolation)
    async def conflict(_: Request, e: Exception) -> JSONResponse:
        # what the database refuses for integrity: a repeated unique value, a foreign key that points at nothing or a
        # row others still point to, a null in a required column (the cases of Spring's
        # DataIntegrityViolationException, which Spring Data REST answers 409); never the database's words: they
        # name a constraint, a column, a value
        return JSONResponse(status_code=409, content=error_body(409, "conflict"))

    # what nothing handled is logged and answered 500 `error` by the Edge: never the reason, which may hold what the
    # app must not show

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


def _not_allowed(app: FastAPI, request: Request, guards: Any) -> Response:
    """A path the app has with another method: 405 with the methods it has (`Allow`), or, for OPTIONS, 200 with them;
    after the app's guards, as a route would be."""
    from starlette.routing import Match

    e = refusal(guards, request.headers)
    if e is not None:
        return JSONResponse(status_code=e.status, content=error_body(e.status, e.message))
    methods: set[str] = {"OPTIONS"}
    # the controllers' routes (mounted under their routers) and the app's own
    for route in [*getattr(app.state, "synapsis_routes", []), *app.router.routes]:
        match, _ = route.matches({**request.scope, "method": "GET"})
        found = getattr(route, "methods", None)
        if match != Match.NONE and found:
            methods |= set(found)
    allow = ", ".join(m for m in ("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS") if m in methods)
    if request.method == "OPTIONS":
        return Response(status_code=200, headers={"Allow": allow})
    return JSONResponse(status_code=405, content=error_body(405, "method not allowed"), headers={"Allow": allow})


class _Quiet(logging.Filter):
    # the server's own lines of a WebSocket name its path with the query: the app logs the upgrade itself; an upgrade
    # refused with an HTTP answer (the guards' status) is no error of the app, whatever the server says of it
    def filter(self, record: logging.LogRecord) -> bool:
        text = str(record.msg)
        return not (text.startswith('%s - "WebSocket') or text.startswith("connection ") or text == "ASGI callable returned without completing handshake.")


def _quiet_server() -> None:
    """The server's access log is the app's own line (Edge): the server's is off, whatever started it."""
    logging.getLogger("uvicorn.access").disabled = True
    error = logging.getLogger("uvicorn.error")
    if not any(isinstance(f, _Quiet) for f in error.filters):
        error.addFilter(_Quiet())


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
