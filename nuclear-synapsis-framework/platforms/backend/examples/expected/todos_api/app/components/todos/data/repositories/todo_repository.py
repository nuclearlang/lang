from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from synapsis import Page, Repository
from typing import Awaitable


class TodoRepository(Repository[Todo]):
    """The todos of the database: find, findAll, save and remove come with it."""

    def page(self, page: int, size: int = 20) -> Awaitable[Page[Todo]]:
        q = self.query()
        q.order_by("id")
        return q.paginate(page, size)
