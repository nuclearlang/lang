from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from app.components.todos.domain.models.new_todo import NewTodo
from app.components.todos.todos_appcomponent import TodosAppComponent
from synapsis import AppError, Result, controller, delete, get, post, put


@controller("todos")
class TodosController:
    """The routes of todos."""

    def __init__(self, app: TodosAppComponent) -> None:
        self.app = app

    @get
    async def list(self, page: int = 1) -> Result[AppError, list[Todo]]:
        return await self.app.list_todos(page)

    @get("{id}")
    async def one(self, id: int) -> Result[AppError, Todo]:
        return await self.app.get_todo(id)

    @post
    async def create(self, input: NewTodo) -> Result[AppError, Todo]:
        return await self.app.create_todo(input)

    @put("{id}")
    async def update(self, id: int, input: NewTodo) -> Result[AppError, Todo]:
        return await self.app.update_todo(id, input)

    @delete("{id}")
    async def remove(self, id: int) -> Result[AppError, bool]:
        return await self.app.delete_todo(id)
