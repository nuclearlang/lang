from __future__ import annotations

from annotated_types import MaxLen, MinLen
from synapsis import Model
from typing import Annotated


class NewCharacter(Model):
    """What the API receives to create a character."""

    name: Annotated[str, MinLen(1), MaxLen(100)]
    status: str = "alive"
    species: str | None = None
