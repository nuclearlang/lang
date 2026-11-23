"""Controllers: REST endpoints over FastAPI, declared like NestJS (@controller, @get, @post...).

An endpoint that returns `Result[E, T]` answers T with its status, or the error's `status` with its message.
An entity in the body or the answer is read and written through its pydantic schema (orm.schema_of).
"""

from __future__ import annotations

import builtins
import functools
import inspect
import keyword
import re
import typing
from collections.abc import Callable
from typing import Annotated, Any, overload, get_args, get_origin

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, create_model
from pydantic.alias_generators import to_camel

from .errors import AppError
from .guards import Guard, refusal
from .orm import Entity, schema_of, wire_of
from .repository import Page
from .result import Result
from .wire import parse_param, read_json

__all__ = ["controller", "get", "post", "put", "patch", "delete", "status", "router_of", "untraced", "guarded"]


def _segment(path: str) -> str:
    """Routes are segments without a leading slash (`"tasks"`, `"{id}"`): the slash is added here; `""` stays empty."""
    path = path.strip("/")
    return f"/{path}" if path else ""


def controller[C: type](prefix: str = "", tags: list[str] | None = None, guards: list[Guard] | None = None) -> Callable[[C], C]:
    """@controller("characters"): the routes of the class start with the prefix; `guards` check every one of them
    (ADR-synapsis-0007)."""

    def mark(cls: C) -> C:
        cls.__synapsis_prefix__ = _segment(prefix)  # type: ignore[attr-defined]
        cls.__synapsis_tags__ = tags or [prefix.strip("/").split("/")[0] or cls.__name__]  # type: ignore[attr-defined]
        cls.__synapsis_guards__ = list(guards or [])  # type: ignore[attr-defined]
        return cls

    return mark


def guarded(guards: list[Guard]) -> Any:
    """The FastAPI dependency that runs `guards` on a request's headers: a refusal answers its status."""

    async def check(request: Request) -> None:
        e = refusal(guards, request.headers)
        if e is not None:
            raise HTTPException(e.status, e.message)

    return Depends(check)


def _route(method: str, path: str, status: int | None) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def mark(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn.__synapsis_route__ = (method, _segment(path), status)  # type: ignore[attr-defined]
        return fn

    return mark


_Route = Callable[[Callable[..., Any]], Callable[..., Any]]


def _verb(method: str, path: str | Callable[..., Any], status: int | None) -> Any:
    """`@get` (bare, Nuclear writes it so) or `@get("path")`: a route either way."""
    if callable(path):
        return _route(method, "", status)(path)
    return _route(method, path, status)


@overload
def get(path: Callable[..., Any]) -> Callable[..., Any]: ...
@overload
def get(path: str = "", status: int | None = None) -> _Route: ...
def get(path: str | Callable[..., Any] = "", status: int | None = None) -> Any:
    return _verb("GET", path, status)


@overload
def post(path: Callable[..., Any]) -> Callable[..., Any]: ...
@overload
def post(path: str = "", status: int | None = 201) -> _Route: ...
def post(path: str | Callable[..., Any] = "", status: int | None = 201) -> Any:
    return _verb("POST", path, status)


@overload
def put(path: Callable[..., Any]) -> Callable[..., Any]: ...
@overload
def put(path: str = "", status: int | None = None) -> _Route: ...
def put(path: str | Callable[..., Any] = "", status: int | None = None) -> Any:
    return _verb("PUT", path, status)


@overload
def patch(path: Callable[..., Any]) -> Callable[..., Any]: ...
@overload
def patch(path: str = "", status: int | None = None) -> _Route: ...
def patch(path: str | Callable[..., Any] = "", status: int | None = None) -> Any:
    return _verb("PATCH", path, status)


@overload
def delete(path: Callable[..., Any]) -> Callable[..., Any]: ...
@overload
def delete(path: str = "", status: int | None = None) -> _Route: ...
def delete(path: str | Callable[..., Any] = "", status: int | None = None) -> Any:
    return _verb("DELETE", path, status)


def status(code: int) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """@status(201): the status of a successful answer (the platform's; @post answers 201 by itself)."""

    def mark(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn.__synapsis_status__ = code  # type: ignore[attr-defined]
        return fn

    return mark


def untraced[T](target: T) -> T:
    """`@untraced`: no span for this route, use case or controller (every route of it). Without telemetry it does
    nothing; with it, the request starts no trace (synapsis.telemetry)."""
    setattr(target, "__synapsis_untraced__", True)
    return target


def _answer_type(t: Any) -> Any:
    """The type of the answer: T of Result[E, T]; an entity becomes its schema."""
    if get_origin(t) is Result or (isinstance(t, type) and issubclass(t, Result)):
        args = get_args(t)
        t = args[1] if len(args) == 2 else Any
    if get_origin(t) is list and get_args(t) and _is_entity(get_args(t)[0]):
        return list[schema_of(get_args(t)[0])]  # type: ignore[misc]
    if get_origin(t) is Page and get_args(t):
        return _page_schema(_answer_type(get_args(t)[0]))
    return schema_of(t) if _is_entity(t) else t


_pages: dict[Any, type[BaseModel]] = {}


def _page_schema(item: Any) -> type[BaseModel]:
    """The pydantic model of a Page of `item` (what the answer of a paged route looks like)."""
    if item not in _pages:
        name = f"Page{getattr(item, '__name__', 'Item')}"
        items: Any = list[item]  # pyright: ignore[reportInvalidTypeForm]
        _pages[item] = create_model(name, items=(items, ...), page=(int, ...), size=(int, ...), total=(int, ...), pages=(int, ...))
    return _pages[item]


def _is_entity(t: Any) -> bool:
    return isinstance(t, type) and issubclass(t, Entity)


def _out(value: Any) -> Any:
    if isinstance(value, Entity):
        # only the loaded relations are read (an unloaded one is left out, never fetched)
        return wire_of(value)
    if isinstance(value, Page):
        p = typing.cast(Page[Any], value)
        items = [_out(i) for i in p.items]
        return {"items": items, "page": p.page, "size": p.size, "total": p.total, "pages": p.pages}
    if isinstance(value, list):
        return [_out(v) for v in typing.cast(list[Any], value)]
    return value


def _public(name: str) -> str | None:
    """The name a client uses for a parameter whose Python name is not Nuclear's: one written with a trailing `_`
    because its own name is a Python word or builtin (`type_` → `type`, `from_` → `from`), or one of several words
    (`min_total` → `minTotal`: the wire has Nuclear's names, as the models do); None for any other parameter."""
    base = name[:-1]
    if name.endswith("_") and base and (keyword.iskeyword(base) or hasattr(builtins, base)):
        return base
    camel = to_camel(name)
    return camel if camel != name else None


def _route_path(path: str, fn: Callable[..., Any]) -> str:
    """The route's path with each `{x}` written as the parameter that takes it (`{type}` → `{type_}`, `{customerId}` →
    `{customer_id}`): the URL it matches is the same."""
    names = inspect.signature(fn).parameters

    def segment(m: re.Match[str]) -> str:
        name = m.group(1)
        if name in names:
            return m.group(0)
        return next((f"{{{n}}}" for n in names if _public(n) == name), m.group(0))

    return re.sub(r"\{(\w+)\}", segment, path)


class _JsonRequest(Request):
    """A request whose JSON body is read by the platform's rules (synapsis.wire): UTF-8, no NaN, a limited depth."""

    async def json(self) -> Any:
        if not hasattr(self, "_json"):
            self._json = read_json(await self.body())
        return self._json


class _JsonRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Any]:
        handler = super().get_route_handler()

        async def read(request: Request) -> Any:
            return await handler(_JsonRequest(request.scope, request.receive))

        return read


_KINDS = {int: "int", float: "float", bool: "bool", str: "str"}


def _scalar(t: Any) -> tuple[str | None, bool]:
    """The kind of a parameter of the path or the query (int, float, bool, str; None for another type), and
    whether it may be None."""
    args = [a for a in get_args(t) if a is not type(None)]
    optional = len(args) < len(get_args(t))
    base = args[0] if optional and len(args) == 1 else t
    return _KINDS.get(base), optional


def _reader(specs: list[tuple[str, str, str, str | None, bool, Any]]) -> Any:
    """The dependency that reads the parameters of the path and the query (synapsis.wire.parse_param): when any is
    refused, the answer is 400 with the reason of each one; the body is checked only after they pass."""

    async def read(request: Request) -> dict[str, Any]:
        out: dict[str, Any] = {}
        refused: list[dict[str, Any]] = []
        for local, public, where, kind, optional, default in specs:
            values = [request.path_params[local]] if where == "path" and local in request.path_params else request.query_params.getlist(public)
            value, why = parse_param(public, [str(v) for v in values], kind or "str")
            if why is not None:
                refused.append({"type": "synapsis", "loc": (where, public), "synapsis": why})
            elif value is None:
                if default is not inspect.Parameter.empty:
                    value = default
                elif not optional:
                    refused.append({"type": "missing", "loc": (where, public)})
            out[local] = value
        if refused:
            raise RequestValidationError(refused)
        return out

    return Depends(read)


def _endpoint(fn: Callable[..., Any], path: str = "") -> Callable[..., Any]:
    """The bound method as FastAPI sees it: a body is a model (real types, entities as schemas), read by FastAPI; the
    parameters of the path and the query are read by the platform's rules, in one dependency; Result unwrapped."""
    hints = typing.get_type_hints(fn)
    sig = inspect.signature(fn)
    in_path = set(re.findall(r"\{(\w+)\}", path))
    entities: dict[str, type[Entity]] = {}
    params: list[inspect.Parameter] = []
    specs: list[tuple[str, str, str, str | None, bool, Any]] = []
    for p in sig.parameters.values():
        t = hints.get(p.name, p.annotation)
        if _is_entity(t):
            entities[p.name] = t
            t = schema_of(t, create=True)
        body = (isinstance(t, type) and issubclass(t, BaseModel)) or get_origin(t) in (list, dict)
        if body:
            params.append(p.replace(annotation=t))
            continue
        public = _public(p.name) or p.name
        kind, optional = _scalar(t)
        specs.append((p.name, public, "path" if p.name in in_path else "query", kind, optional, p.default))
    params.append(inspect.Parameter("synapsis_params", inspect.Parameter.KEYWORD_ONLY, default=_reader(specs), annotation=dict[str, Any]))

    @functools.wraps(fn)
    async def call(**kwargs: Any) -> Any:
        kwargs.update(kwargs.pop("synapsis_params"))
        for name, cls in entities.items():
            kwargs[name] = cls(**kwargs[name].model_dump())
        value = fn(**kwargs)
        if inspect.isawaitable(value):
            value = await value
        if isinstance(value, Result):
            r = typing.cast(Result[Any, Any], value)
            if r.is_err:
                e = r.error
                status = e.status if isinstance(e, AppError) else 500
                raise HTTPException(status, getattr(e, "message", str(e)))
            value = r.value
        return _out(value)

    call.__signature__ = sig.replace(parameters=params, return_annotation=_answer_type(hints.get("return")))  # type: ignore[attr-defined]
    return call


def router_of(instance: object) -> APIRouter:
    """The FastAPI router of a controller instance. A fixed segment wins over a parameter whatever the order of the
    routes (`search` over `{id}`): FastAPI takes the first route that matches, so a route with a parameter earlier in
    its path is added later."""
    cls = type(instance)
    guards: list[Guard] = getattr(cls, "__synapsis_guards__", [])
    router = APIRouter(
        prefix=getattr(cls, "__synapsis_prefix__", ""),
        tags=getattr(cls, "__synapsis_tags__", None),
        dependencies=[guarded(guards)] if guards else None,
        route_class=_JsonRoute,
    )
    routes = [(name, r) for name in dir(cls) if (r := getattr(getattr(cls, name, None), "__synapsis_route__", None)) is not None]
    routes.sort(key=lambda found: [segment.startswith("{") for segment in found[1][1].split("/")])
    for name, (method, path, route_status) in routes:
        status = getattr(getattr(cls, name, None), "__synapsis_status__", None) or route_status
        method_fn = getattr(instance, name)
        path = _route_path(path, method_fn)
        endpoint = _endpoint(method_fn, path)
        if getattr(cls, "__synapsis_untraced__", False):
            setattr(endpoint, "__synapsis_untraced__", True)
        kw: dict[str, Any] = {"status_code": status} if status else {}
        router.add_api_route(path, endpoint, methods=[method], name=f"{cls.__name__}.{name}", **kw)
        if method == "GET":
            # HEAD answers as its GET without the body (the server leaves it out)
            router.add_api_route(path, endpoint, methods=["HEAD"], name=f"{cls.__name__}.{name}.head", include_in_schema=False, **kw)
    return router
