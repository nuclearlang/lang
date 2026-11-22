"""The models of an app (ADR-synapsis-0012): their JSON has Nuclear's names (camelCase, `lastRead`), the same JSON as
every other dialect and as the project's contract; Python reads a model by either name and writes it with Nuclear's.
A `DateTime` is written as Nuclear's `toIso()` writes it, in every dialect: UTC with milliseconds
(`2026-03-04T05:06:07.000Z`)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, SerializationInfo, SerializerFunctionWrapHandler, model_serializer
from pydantic.alias_generators import to_camel

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


class Model(BaseModel):
    """A `model` of the app: its fields in Python's case, its JSON in Nuclear's."""

    model_config = WIRE

    @model_serializer(mode="wrap")
    def _wire(self, handler: SerializerFunctionWrapHandler, info: SerializationInfo) -> Any:
        return wire_dates(self, handler(self), info)
