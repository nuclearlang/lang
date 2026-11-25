from __future__ import annotations

from app.plugins.sqlite import SQLite
from synapsis import AppConfig, Connection, Ollama, env


class ProjectConfig(AppConfig):
    """The connections of the whole app: a database and a chat model."""

    connections: list[Connection] = [
        SQLite(file=env("DATABASE", "rick.sqlite"), create_tables=True),
        Ollama(model=env("CHAT_MODEL", "llama3.2")),
    ]
