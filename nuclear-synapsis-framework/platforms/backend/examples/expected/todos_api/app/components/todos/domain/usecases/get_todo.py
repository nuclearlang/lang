from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from app.components.todos.data.repositories.todo_repository import TodoRepository
from synapsis import AppError, Result


class GetTodo:
    """One todo by its id; NotFound (404) when there is none."""

    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    async def exec(self, id: int) -> Result[AppError, Todo]:
        return await self.repository.find(id)
