from __future__ import annotations

from synapsis import Model


class NewTodo(Model):
    """What it takes to add or change a todo."""

    title: str
    completed: bool
