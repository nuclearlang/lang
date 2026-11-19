"""The models of an app (ADR-synapsis-0012): their JSON has Nuclear's names (camelCase, `lastRead`), the same JSON as
every other dialect and as the project's contract; Python reads a model by either name and writes it with Nuclear's."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

__all__ = ["Model", "WIRE"]

# the configuration every model and entity schema of the app shares
WIRE = ConfigDict(alias_generator=to_camel, validate_by_name=True, validate_by_alias=True, serialize_by_alias=True)


class Model(BaseModel):
    """A `model` of the app: its fields in Python's case, its JSON in Nuclear's."""

    model_config = WIRE
