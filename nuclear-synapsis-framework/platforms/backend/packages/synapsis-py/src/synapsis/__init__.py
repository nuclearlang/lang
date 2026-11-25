"""Synapsis for Python: the runtime of NuclearLang's fastapi dialect (spec/fastapi.md).

The optional parts are their own modules, imported only by the projects whose config.nuc enables their plugin:
`synapsis.ai` (LangChain, LangGraph), `synapsis.events` (Kafka, Redis), `synapsis.telemetry` (OpenTelemetry).
"""

from .app import connection, connections, create_app
from .config import (
    AppConfig,
    ChatModel,
    Chroma,
    ComponentConfig,
    Connection,
    Database,
    Embeddings,
    Kafka,
    MariaDB,
    MySQL,
    Ollama,
    OpenAI,
    Redis,
    SQLite,
    env,
)
from .exact import BigDouble, BigInt
from .errors import AppError, Conflict, Forbidden, Invalid, NotFound, Unauthorized
from .guards import Guard, NoOrigin, Token
from .http import Http, HttpRepository
from .models import Model
from .inject import bind, inject, provide
from .orm import Entity, Mapped, column, created, many_to_many, many_to_one, one_to_many, one_to_one, primary, updated
from .repository import (
    Page,
    Query,
    Repository,
    between,
    contains,
    gt,
    gte,
    icontains,
    ilike,
    is_null,
    like,
    lt,
    lte,
    ne,
    one_of,
    transactional,
)
from .result import Err, Ok, Result
from .web import controller, delete, get, patch, post, put, status, untraced

__all__ = [
    "AppConfig", "AppError", "BigDouble", "BigInt", "ChatModel", "Chroma", "ComponentConfig", "Conflict", "Connection", "Database",
    "Embeddings", "Entity", "Err", "Forbidden", "Guard", "NoOrigin", "Token", "Http", "HttpRepository", "Invalid", "Kafka", "Mapped", "MariaDB", "Model", "MySQL",
    "NotFound", "Ok", "Ollama", "OpenAI", "Page", "Query", "Redis", "Repository", "Result", "SQLite", "Unauthorized", "between", "bind", "column", "connection", "connections", "contains",
    "controller", "create_app", "created", "delete", "env", "get", "gt", "gte", "icontains", "ilike", "one_of", "status",
    "inject", "is_null", "like", "lt", "lte", "many_to_many", "many_to_one", "ne", "one_to_many", "one_to_one",
    "patch", "post", "primary", "provide", "put", "transactional", "untraced", "updated", ]
