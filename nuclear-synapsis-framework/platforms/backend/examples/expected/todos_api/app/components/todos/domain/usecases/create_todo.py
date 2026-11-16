from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from app.components.todos.data.repositories.todo_repository import TodoRepository
from app.components.todos.domain.models.new_todo import NewTodo
from synapsis import AppError, Ok, Result


class CreateTodo:
    """Adds a todo."""

    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    async def exec(self, input: NewTodo) -> Result[AppError, Todo]:
        return Ok(await self.repository.save(Todo(title=input.title, completed=input.completed)))
