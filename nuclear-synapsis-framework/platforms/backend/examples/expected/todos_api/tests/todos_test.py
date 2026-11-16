from __future__ import annotations

from app.components.todos.domain.models.new_todo import NewTodo
from app.components.todos.todos_appcomponent import TodosAppComponent
from synapsis import inject


class TestTodosTest:
    """The tests of todos: the database is in memory and empty in each test."""

    async def test_adds_and_finds(self) -> None:
        "adds a todo and finds it"
        app = inject(TodosAppComponent)
        made = await app.create_todo(NewTodo(title="title", completed=True))
        assert made.is_ok
        found = await app.get_todo(made.value.id)
        assert found.is_ok

    async def test_missing(self) -> None:
        "a missing todo is not found"
        app = inject(TodosAppComponent)
        found = await app.get_todo(999)
        assert found.error.status == 404
