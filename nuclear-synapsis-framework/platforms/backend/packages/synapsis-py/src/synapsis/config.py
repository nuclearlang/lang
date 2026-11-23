"""Configuration: the connections of the app (databases, caches, brokers, AI models, vector stores).

`AppConfig.connections` (config/project_config.nuc) and `ComponentConfig.connections` list them; each one is
opened when the app starts and closed when it stops. Values usually come from the environment: `env("X", "default")`.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, ClassVar

if TYPE_CHECKING:
    from .guards import Guard


def load_env_file(path: str = ".env") -> None:
    """Loads the app's `.env` (the one `nuclear build --env <environment>` writes beside the app, spec 021) into the
    process environment, without replacing a variable the process already has (production sets its secrets there).
    Lines: `NAME=value` or `NAME="value"` with the escapes `\\n`, `\\r`, `\\t`, `\\"`, `\\\\`, `\\$`; `#` comments."""
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = (part.strip() for part in line.split("=", 1))
        name = name.removeprefix("export ").strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = _unescaped(value[1:-1])
        os.environ.setdefault(name, value)


def _unescaped(text: str) -> str:
    out: list[str] = []
    chars = iter(text)
    for c in chars:
        if c == "\\":
            nxt = next(chars, "")
            out.append({"n": "\n", "r": "\r", "t": "\t"}.get(nxt, nxt))
        else:
            out.append(c)
    return "".join(out)


# the app's folder is where it runs (the build's folder): its .env, before any env() of the app is read
load_env_file()


def env(name: str, default: str = "") -> str:
    """The environment variable `name`, or `default`."""
    return os.environ.get(name, default)


class Connection:
    """Something the app opens at start and closes at stop. `name` tells two connections of a kind apart."""

    name: str = "default"

    async def open(self) -> None:
        pass

    async def close(self) -> None:
        pass

    def instrument(self, app: Any) -> None:
        """Called by create_app with the web app once its routes are mounted (telemetry hooks in here)."""


_DRIVERS = {"postgres": "postgresql+asyncpg", "postgresql": "postgresql+asyncpg", "mysql": "mysql+aiomysql", "mariadb": "mariadb+aiomysql", "sqlite": "sqlite+aiosqlite"}


def _with_driver(url: str) -> str:
    """`postgres://user:pass@host/db` (the platform's URL, the same in every dialect) with the async driver SQLAlchemy
    needs; a URL that already names one (`postgresql+asyncpg://`) is kept."""
    scheme, sep, rest = url.partition("://")
    if not sep or "+" in scheme:
        return url
    return f"{_DRIVERS.get(scheme, scheme)}://{rest}"


class Database(Connection):
    """A SQL database through SQLAlchemy 2 async. `url`: `postgres://`, `mysql://`, `mariadb://` (the driver is
    chosen here). `create_tables` creates the entities' tables at start (development)."""

    def __init__(self, url: str, name: str = "default", create_tables: bool = False, echo: bool = False) -> None:
        self.url = _with_driver(url)
        self.name = name
        self.create_tables = create_tables
        self.echo = echo
        self.engine: Any = None
        self.sessions: Any = None
        self.reads: Any = None

    async def open(self) -> None:
        from sqlalchemy import event
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
        from sqlalchemy.orm import configure_mappers

        self.engine = create_async_engine(self.url, echo=self.echo)
        if self.url.startswith("sqlite"):
            # SQLite checks foreign keys (and their ON DELETE) only when asked, as sequelize does for nestjs
            event.listen(self.engine.sync_engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        # a read outside a transaction is one statement: no BEGIN and ROLLBACK around it, where the driver turns
        # autocommit on without a statement of its own (PostgreSQL, SQLite); a write and `@transactional` use `sessions`
        reads = self.engine.execution_options(isolation_level="AUTOCOMMIT") if self.url.startswith(("postgresql", "sqlite")) else self.engine
        self.reads = async_sessionmaker(reads, expire_on_commit=False)
        configure_mappers()  # the relations and their join tables exist before the tables are created
        if self.create_tables:
            from .migrate import create_tables

            async with self.engine.begin() as conn:
                await conn.run_sync(create_tables)

    async def close(self) -> None:
        if self.engine is not None:
            await self.engine.dispose()


class Postgres(Database):
    """PostgreSQL (asyncpg): Postgres(url = env("DATABASE_URL", "postgres://localhost/app"))."""


class MySQL(Database):
    """MySQL (aiomysql): MySQL(url = "mysql://user:pass@localhost/app")."""


class MariaDB(Database):
    """MariaDB (aiomysql): MariaDB(url = "mariadb://user:pass@localhost/app")."""


class SQLite(Database):
    """SQLite (aiosqlite): SQLite(file = "app.sqlite"); ":memory:" for tests."""

    def __init__(self, file: str = ":memory:", name: str = "default", create_tables: bool = False, echo: bool = False) -> None:
        super().__init__(f"sqlite:///{file}", name, create_tables, echo)
        self.file = file


class Redis(Connection):
    """Redis (redis.asyncio): a cache and pub/sub. `client` is the redis.asyncio.Redis once open."""

    def __init__(self, url: str = "redis://localhost:6379/0", name: str = "default") -> None:
        self.url = url
        self.name = name
        self.client: Any = None

    async def open(self) -> None:
        from redis.asyncio import Redis as Client

        self.client = Client.from_url(self.url, decode_responses=True)

    async def close(self) -> None:
        if self.client is not None:
            await self.client.aclose()


class Kafka(Connection):
    """Kafka (aiokafka): `publish(topic, value)` sends; the `listener` kinds consume (group = the app's name)."""

    def __init__(self, servers: str = "localhost:9092", group: str = "app", name: str = "default") -> None:
        self.servers = servers
        self.group = group
        self.name = name
        self.producer: Any = None

    async def open(self) -> None:
        from aiokafka import AIOKafkaProducer

        self.producer = AIOKafkaProducer(bootstrap_servers=self.servers)
        await self.producer.start()

    async def close(self) -> None:
        if self.producer is not None:
            await self.producer.stop()


class ChatModel(Connection):
    """A chat model (LangChain `init_chat_model`): OpenAI(model = "gpt-4o-mini"), Ollama(model = "llama3.2")."""

    provider: ClassVar[str] = ""

    def __init__(self, model: str, name: str = "default", temperature: float = 0.0, **options: Any) -> None:
        self.model = model
        self.name = name
        self.temperature = temperature
        self.options = options
        self.client: Any = None

    async def open(self) -> None:
        from langchain.chat_models import init_chat_model

        self.client = init_chat_model(
            self.model, model_provider=self.provider, temperature=self.temperature, **self.options
        )


class OpenAI(ChatModel):
    """OpenAI chat model (langchain-openai; the key comes from OPENAI_API_KEY)."""

    provider = "openai"


class Ollama(ChatModel):
    """A local Ollama chat model (langchain-ollama): Ollama(model = "llama3.2", base_url = "http://localhost:11434")."""

    provider = "ollama"


class Embeddings(Connection):
    """An embeddings model (LangChain `init_embeddings`): Embeddings(model = "openai:text-embedding-3-small")."""

    def __init__(self, model: str, name: str = "default", **options: Any) -> None:
        self.model = model
        self.name = name
        self.options = options
        self.client: Any = None

    async def open(self) -> None:
        from langchain.embeddings import init_embeddings

        self.client = init_embeddings(self.model, **self.options)


class Chroma(Connection):
    """A Chroma vector store (langchain-chroma) on a Chroma server, with the named `Embeddings` connection:
    Chroma(collection = "facts", url = "http://localhost:8000")."""

    def __init__(
        self, collection: str, embeddings: str = "default", url: str = "http://localhost:8000", name: str = "default"
    ) -> None:
        self.collection = collection
        self.embeddings = embeddings
        self.url = url
        self.name = name
        self.store: Any = None

    async def open(self) -> None:
        from urllib.parse import urlparse

        import chromadb
        from langchain_chroma import Chroma as Store

        from .app import connection

        model = connection(Embeddings, self.embeddings).client
        parsed = urlparse(self.url)
        client = chromadb.HttpClient(host=parsed.hostname or "localhost", port=parsed.port or 8000, ssl=parsed.scheme == "https")
        self.store = Store(self.collection, embedding_function=model, client=client)


class AppConfig:
    """The project configuration (config/project_config.nuc): its connections, the guards every route passes
    (ADR-synapsis-0007), the web origins whose browsers may call the API (CORS), the largest body or WebSocket frame
    the app reads (bytes) and the largest page `paginate` answers (rows)."""

    connections: list[Connection] = []
    guards: list[Guard] = []
    origins: list[str] = []
    max_body_size: int = 1024 * 1024
    max_page_size: int = 100


class ComponentConfig:
    """The configuration of one component: connections only it uses."""

    connections: list[Connection] = []
