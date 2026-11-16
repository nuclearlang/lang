from __future__ import annotations

from app.components.todos.data.entities.todo import Todo
from app.components.todos.domain.models.new_todo import NewTodo
from app.components.todos.domain.usecases.create_todo import CreateTodo
from app.components.todos.domain.usecases.delete_todo import DeleteTodo
from app.components.todos.domain.usecases.get_todo import GetTodo
from app.components.todos.domain.usecases.list_todos import ListTodos
from app.components.todos.domain.usecases.update_todo import UpdateTodo
from synapsis import AppError, Result, inject


class TodosAppComponent:
    """What the rest of the app sees of todos: an alias for each of its use cases."""

    async def list_todos(self, page: int) -> Result[AppError, list[Todo]]:
        return await inject(ListTodos).exec(page)

    async def get_todo(self, id: int) -> Result[AppError, Todo]:
        return await inject(GetTodo).exec(id)

    async def create_todo(self, input: NewTodo) -> Result[AppError, Todo]:
        return await inject(CreateTodo).exec(input)

    async def update_todo(self, id: int, input: NewTodo) -> Result[AppError, Todo]:
        return await inject(UpdateTodo).exec(id, input)

    async def delete_todo(self, id: int) -> Result[AppError, bool]:
        return await inject(DeleteTodo).exec(id)
