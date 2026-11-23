"""The models of an app (ADR-synapsis-0012): their JSON has Nuclear's names (camelCase, `lastRead`), the same JSON as
every other dialect and as the project's contract; Python reads a model by either name and writes it with Nuclear's.
A `DateTime` is written as Nuclear's `toIso()` writes it, in every dialect: UTC with milliseconds
(`2026-03-04T05:06:07.000Z`).

A value's JSON type is its field's (the platform's reference, §2.3): the validator converts nothing. A text is never a
number, a number or a text is never a boolean, a number is never a `DateTime`; a number without a fraction is a whole
number (`30.0`, as JSON has one kind of number) and a whole number is a `double`."""

from __future__ import annotations

import math
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, GetCoreSchemaHandler, SerializationInfo, SerializerFunctionWrapHandler, model_serializer
from pydantic.alias_generators import to_camel
from pydantic_core import PydanticCustomError, core_schema

INT_MIN, INT_MAX = -(2**63), 2**63 - 1

__all__ = ["Model", "WIRE", "wire_date", "wire_dates"]

# the configuration every model and entity schema of the app shares
WIRE = ConfigDict(alias_generator=to_camel, validate_by_name=True, validate_by_alias=True, serialize_by_alias=True)


def wire_date(value: datetime) -> str:
    """`value` as the JSON of every dialect has it; without a time zone it is local time."""
    u = value.astimezone(UTC)
    return u.strftime("%Y-%m-%dT%H:%M:%S.") + f"{u.microsecond // 1000:03d}Z"


def wire_dates(model: BaseModel, data: Any, info: SerializationInfo) -> Any:
    """`data` (what pydantic serialized of `model`) with its dates as the wire has them, when it is JSON."""
    if info.mode == "json" and isinstance(data, dict):
        for name in type(model).model_fields:
            value = getattr(model, name, None)
            if isinstance(value, datetime):
                for key in (name, to_camel(name)):
                    if key in data:
                        data[key] = wire_date(value)
    return data


def _only(kind: str, *allowed: type) -> Callable[[Any], Any]:
    def check(value: Any) -> Any:
        # None goes on: the type itself says whether the field may be empty
        if value is not None and (isinstance(value, bool) or not isinstance(value, allowed)):
            raise PydanticCustomError(f"{kind}_type", "a value of another type")  # pyright: ignore[reportArgumentType]
        # a number is finite; an `int` holds 64 bits (the reference, §2.3): beyond either, it is not of the type
        if isinstance(value, float) and not math.isfinite(value):
            raise PydanticCustomError(f"{kind}_type", "a number that is not finite")  # pyright: ignore[reportArgumentType]
        if kind == "int" and isinstance(value, (int, float)) and not INT_MIN <= value <= INT_MAX:
            raise PydanticCustomError("int_type", "a whole number beyond 64 bits")
        return value

    return check


# what the validator would convert, by the kind of its schema: the Python types a JSON value of that kind has
_CHECKS = {"int": _only("int", int, float), "float": _only("float", int, float), "datetime": _only("datetime", str, datetime)}


def typed(schema: Any) -> Any:
    """`schema` (pydantic's core schema of a model) with every whole number, number, boolean and date refusing a value
    of another JSON type, at any depth (a list, a nested model). The keys of a map are texts in JSON: they convert."""
    if isinstance(schema, list):
        return [typed(s) for s in schema]  # pyright: ignore[reportUnknownVariableType]
    if not isinstance(schema, dict):
        return schema
    kind = schema.get("type")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    if not isinstance(kind, str):
        kind = None  # the fields of a model, one of them named `type`: its value is that field's schema
    if kind == "function-before" and schema["function"].get("function") in _CHECKS.values():  # pyright: ignore[reportUnknownMemberType]
        return schema  # a nested model: its own schema is already typed  # pyright: ignore[reportUnknownVariableType]
    skipped = ("serialization", "metadata", "keys_schema")
    out: dict[str, Any] = {k: v if k in skipped else typed(v) for k, v in schema.items()}  # pyright: ignore[reportUnknownVariableType]
    if kind == "bool":
        out["strict"] = True
    elif kind in _CHECKS:
        return core_schema.no_info_before_validator_function(_CHECKS[kind], out)  # pyright: ignore[reportArgumentType]
    return out


class Model(BaseModel):
    """A `model` of the app: its fields in Python's case, its JSON in Nuclear's."""

    model_config = WIRE

    @classmethod
    def __get_pydantic_core_schema__(cls, source: type[BaseModel], handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        return typed(handler(source))

    @model_serializer(mode="wrap")
    def _wire(self, handler: SerializerFunctionWrapHandler, info: SerializationInfo) -> Any:
        return wire_dates(self, handler(self), info)
