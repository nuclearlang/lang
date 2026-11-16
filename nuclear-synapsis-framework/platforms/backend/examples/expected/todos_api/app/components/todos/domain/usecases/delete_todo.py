from __future__ import annotations

from app.components.todos.data.repositories.todo_repository import TodoRepository
from synapsis import AppError, Err, Ok, Result


class DeleteTodo:
    """Removes a todo; NotFound (404) when there is none."""

    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    async def exec(self, id: int) -> Result[AppError, bool]:
        found_result = await self.repository.find(id)
        if found_result.is_err:
            return Err(found_result.error)
        found = found_result.value
        await self.repository.remove(found.id)
        return Ok(True)
