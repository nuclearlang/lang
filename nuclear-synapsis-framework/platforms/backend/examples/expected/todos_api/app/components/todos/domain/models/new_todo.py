from __future__ import annotations

from pydantic import BaseModel


class NewTodo(BaseModel):
    """What it takes to add or change a todo."""

    title: str
    completed: bool
