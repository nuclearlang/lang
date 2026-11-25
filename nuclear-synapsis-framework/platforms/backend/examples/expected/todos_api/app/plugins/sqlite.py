from __future__ import annotations

from synapsis import Database


class SQLite(Database):
    """
    A SQLite database, kept in one file: `SQLite(file = env("DATABASE", "app.sqlite"))` (`":memory:"` keeps it in
    memory). `name` tells it from the other databases of the app (`"default"`); `createTables` makes the entities'
    tables at start (development: a project's schema comes from its migrations).
    """

    driver = "sqlite+aiosqlite"
