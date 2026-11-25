from __future__ import annotations

from app.plugins.sqlite import SQLite
from synapsis import AppConfig, Connection, env


class ProjectConfig(AppConfig):
    """
    The connections of the whole app: databases, chat models, Kafka, Redis (nuclear help backend, §2.8).
    Each one needs its plugin in config.nuc.
    """

    connections: list[Connection] = [SQLite(file=env("DATABASE", "app.sqlite"), create_tables=True)]
