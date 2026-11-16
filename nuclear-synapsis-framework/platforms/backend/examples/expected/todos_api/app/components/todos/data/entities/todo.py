from __future__ import annotations

from synapsis import Entity, Mapped, column, primary


class Todo(Entity):
    """What a todo is: a row of the table todos."""

    __tablename__ = "todos"

    id: Mapped[int] = primary(generated=True)
    title: Mapped[str] = column()
    completed: Mapped[bool] = column()
