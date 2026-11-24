"""The errors of a use case: each one is an HTTP status when a controller returns it."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Any


@dataclass(frozen=True)
class AppError:
    """A failure the caller can handle. `status` is the HTTP status a controller answers with."""

    message: str = "error"
    status: int = 500


@dataclass(frozen=True)
class Invalid(AppError):
    message: str = "invalid"
    status: int = 400


@dataclass(frozen=True)
class Unauthorized(AppError):
    message: str = "unauthorized"
    status: int = 401


@dataclass(frozen=True)
class Forbidden(AppError):
    message: str = "forbidden"
    status: int = 403


@dataclass(frozen=True)
class NotFound(AppError):
    message: str = "not found"
    status: int = 404


@dataclass(frozen=True)
class Conflict(AppError):
    message: str = "conflict"
    status: int = 409


class IntegrityViolation(Exception):
    """What a database refuses for integrity, refused by the runtime before the database sees it (a text longer than
    its column): the app answers it as it answers the database's own refusal, 409 `conflict`."""


# ---------- the body of an error: Nuclear's, the same in every dialect (ADR-synapsis-0013) ----------

# one reason per field: the first of these rules it breaks
_RULES = ("required", "type", "minLength", "maxLength", "min", "max", "pattern", "email", "url", "json", "invalid")


def reason(field: str, rule: str, value: object = None) -> dict[str, str]:
    """Why a field of a body or a parameter is refused: `field` (a path: `items.0.name`; empty for the body itself),
    `rule` (the name of the validation in Nuclear) and `message`, written here so every dialect says the same."""
    name = field or "the body"
    text = {
        "required": f"{name} is required",
        "type": f"{name} must be {value}",
        "minLength": f"{name} must have at least {_number(value)} characters",
        "maxLength": f"{name} must have at most {_number(value)} characters",
        "min": f"{name} must be at least {_number(value)}",
        "max": f"{name} must be at most {_number(value)}",
        "pattern": f"{name} does not match its pattern",
        "email": f"{name} must be an e-mail address",
        "url": f"{name} must be a URL",
        "json": "the body is not valid JSON",
    }.get(rule, f"{name} is not valid")
    return {"field": field, "rule": rule if rule in _RULES else "invalid", "message": text}


def _number(value: object) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    # the bound of a `bigdouble` field (the validator gives its repr): its text as Nuclear writes it
    exact = re.fullmatch(r"Decimal\('([^']*)'\)", value) if isinstance(value, str) else None
    if exact is not None or isinstance(value, Decimal):
        from .exact import bigdouble_text

        return bigdouble_text(Decimal(exact.group(1)) if exact is not None else value)  # pyright: ignore[reportArgumentType]
    return str(value)


def error_body(status: int, message: str, errors: Iterable[Mapping[str, str]] | None = None) -> dict[str, Any]:
    """What an error answers: its status, its message and, for an invalid body or parameter, one reason per field
    in the order of the fields' names."""
    body: dict[str, Any] = {"status": status, "message": message}
    if errors is not None:
        first: dict[str, Mapping[str, str]] = {}
        for e in errors:
            kept = first.get(e["field"])
            if kept is None or _RULES.index(e["rule"]) < _RULES.index(kept["rule"]):
                first[e["field"]] = e
        body["errors"] = [dict(first[f]) for f in sorted(first)]
    return body


_TYPES = {
    "string": "a text",
    "str": "a text",
    "int": "a whole number",
    "float": "a number",
    "bigint": "a whole number in a text",
    "bigdouble": "a decimal number in a text",
    "decimal": "a number",
    "bool": "true or false",
    "list": "a list",
    "tuple": "a list",
    "set": "a list",
    "dict": "an object",
    "model": "an object",
    "dataclass": "an object",
    "datetime": "a date and time",
    "date": "a date and time",
}


def reasons_of(errors: Iterable[Mapping[str, Any]]) -> list[dict[str, str]]:
    """The reasons of the validator's errors (pydantic's `errors()`), in Nuclear's words."""
    out: list[dict[str, str]] = []
    for e in errors:
        loc = [str(p) for p in e.get("loc", ())]
        if loc and loc[0] in ("body", "query", "path", "header", "cookie"):
            loc = loc[1:]
        field = ".".join(loc)
        kind = str(e.get("type", ""))
        ctx = e.get("ctx") or {}
        base = kind.split("_")[0]
        if kind == "synapsis":  # a reason already in Nuclear's words (synapsis.wire)
            out.append(dict(e["synapsis"]))
        elif kind == "missing" or (kind.endswith("_type") and e.get("input") is None):
            out.append(reason(field, "required"))
        elif kind == "json_invalid":
            out.append(reason("", "json"))
        elif kind == "string_too_short":
            out.append(reason(field, "minLength", ctx.get("min_length")))
        elif kind == "string_too_long":
            out.append(reason(field, "maxLength", ctx.get("max_length")))
        elif kind in ("greater_than_equal", "greater_than"):
            out.append(reason(field, "min", ctx.get("ge", ctx.get("gt"))))
        elif kind in ("less_than_equal", "less_than"):
            out.append(reason(field, "max", ctx.get("le", ctx.get("lt"))))
        elif kind == "string_pattern_mismatch":
            out.append(reason(field, "pattern"))
        elif kind == "value_error":
            said = str(e.get("msg", "")).lower()
            out.append(reason(field, "email" if "e-mail" in said else "url" if "url" in said else "invalid"))
        elif kind == "finite_number":
            out.append(reason(field, "type", "a number"))
        elif base in _TYPES and (kind.endswith(("_type", "_parsing", "_from_float")) or kind == "model_attributes_type"):
            out.append(reason(field, "type", _TYPES[base]))
        else:
            out.append(reason(field, "invalid"))
    return out
