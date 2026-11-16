from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from app.components.todos.data.repositories.todo_repository import TodoRepository
from synapsis import AppError, Ok, Result


class ListTodos:
    """One page of todos."""

    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    async def exec(self, page: int) -> Result[AppError, list[Todo]]:
        found = await self.repository.page(page, 20)
        return Ok(found.items)
