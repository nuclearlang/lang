from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from app.components.todos.data.repositories.todo_repository import TodoRepository
from app.components.todos.domain.models.new_todo import NewTodo
from synapsis import AppError, Err, Ok, Result


class UpdateTodo:
    """Changes a todo; NotFound (404) when there is none."""

    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    async def exec(self, id: int, input: NewTodo) -> Result[AppError, Todo]:
        found_result = await self.repository.find(id)
        if found_result.is_err:
            return Err(found_result.error)
        found = found_result.value
        found.title = input.title
        found.completed = input.completed
        return Ok(await self.repository.save(found))
