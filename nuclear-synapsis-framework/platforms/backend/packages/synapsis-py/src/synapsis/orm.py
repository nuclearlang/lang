"""Entities: SQLAlchemy 2 tables declared like TypeORM. A field's decorator becomes its column:
@primary() → a key the app gives, @primary(generated = true) → auto increment (int) or a uuid (string),
@column(length = 100, unique = true) → a column. Relations (ADR-backend-0001): @manyToOne, @oneToMany, @manyToMany + @joinTable,
@oneToOne + @joinColumn; a relation is loaded only when a query asks for it (`relations("tasks")`)."""

from __future__ import annotations

import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, ClassVar, cast

from pydantic.alias_generators import to_camel
from pydantic import BaseModel, GetCoreSchemaHandler, SerializationInfo, SerializerFunctionWrapHandler, create_model, model_serializer
from pydantic_core import core_schema
from decimal import Decimal

from sqlalchemy import (
    VARCHAR, BigInteger, Column, DateTime, ForeignKey, ForeignKeyConstraint, Numeric, String, Table, Text, and_, case, func,
    inspect, literal, or_, text, type_coerce,
)
from sqlalchemy.dialects import mysql, sqlite
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import operators
from sqlalchemy.sql.elements import ColumnElement
from sqlalchemy.types import Boolean, TypeDecorator, UserDefinedType
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, RelationshipProperty, mapped_column, relationship

from .exact import MAX_PRECISION, MAX_SCALE, PRECISION, SCALE, BigDouble, BigInt, column_text
from .models import WIRE, typed, wire_dates

__all__ = [
    "Entity", "Mapped", "primary", "column", "created", "updated", "schema_of", "wire_of", "UtcDateTime", "ExactInteger",
    "ExactDecimal",
    "many_to_one", "one_to_many", "many_to_many", "one_to_one",
]


def _snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


# where an entity keeps the @manyToMany lists set on it while they were not loaded (Repository.save writes them)
PENDING = "_synapsis_pending"

# a text column without `length`: what every database takes as a key, a unique column or a column with a default
# (the same length the nestjs dialect writes)
TEXT_LENGTH = 255


# --- a text column: `@column(length = n)`. The one rule of its type (the same as the nestjs dialect's, migrate.ts):
# the database's VARCHAR(n) while it holds n characters of any alphabet, then its text type that does.
# The most characters a VARCHAR holds: MySQL and MariaDB keep 65535 bytes and a character takes up to four;
# PostgreSQL's own limit; SQLite has none.
VARCHAR_MAX = {"mysql": 16383, "mariadb": 16383, "postgres": 10485760}
# the most characters a MEDIUMTEXT of MySQL and MariaDB holds (16777215 bytes); a longer text is a LONGTEXT
MEDIUMTEXT_MAX = 4194303


def text_type(dialect: str, length: int) -> str:
    """The type a text column of `length` characters has on `dialect` (sqlite, postgres, mysql, mariadb), as the
    database names it."""
    if length <= VARCHAR_MAX.get(dialect, length):
        return f"VARCHAR({length})"
    return "TEXT" if dialect == "postgres" else "MEDIUMTEXT" if length <= MEDIUMTEXT_MAX else "LONGTEXT"


@compiles(String, "postgresql", "mysql", "mariadb")
@compiles(VARCHAR, "postgresql", "mysql", "mariadb")
def _text(element: Any, compiler: Any, **kw: Any) -> str:
    # every `String(n)` an entity or a migration names, and the `VARCHAR(n)` a migration's way back names (read from
    # SQLite when it was made): the rule above where the VARCHAR is too short
    dialect = "postgres" if compiler.dialect.name == "postgresql" else compiler.dialect.name
    if element.length is None or element.length <= VARCHAR_MAX[dialect]:
        return str(compiler.visit_VARCHAR(element, **kw))
    return text_type(dialect, element.length)


class _LiteDateTime(sqlite.DATETIME):
    """SQLite's date and time, named with its fraction as MySQL and MariaDB name it (SQLite keeps the words of a type)."""


@compiles(_LiteDateTime, "sqlite")
def _lite_date_time(element: Any, compiler: Any, **kw: Any) -> str:
    del element, compiler, kw
    return f"DATETIME({FRACTION})"


# the digits of a second a `DateTime` column keeps where the database asks: TypeORM's for the date columns it gives a
# fraction on MySQL (ADR-backend-0002); PostgreSQL's own
FRACTION = 6


class UtcDateTime(TypeDecorator[datetime]):
    """A `DateTime` column: an instant. It is written in UTC and read back as UTC on every database (SQLite, MySQL and
    MariaDB keep no time zone, and their drivers would drop the one of the value); a value without a time zone is
    local time, as in the nestjs dialect. It keeps the fraction of a second on every database: `DATETIME(6)` on MySQL,
    MariaDB and SQLite, `TIMESTAMP WITH TIME ZONE` on PostgreSQL. A migration names this type (a migration made before
    0.94 wrote `sa.DateTime(timezone=True)`: whole seconds on MySQL and MariaDB)."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name in ("mysql", "mariadb"):
            return dialect.type_descriptor(mysql.DATETIME(timezone=True, fsp=FRACTION))
        if dialect.name == "sqlite":
            return dialect.type_descriptor(_LiteDateTime(timezone=True))
        return dialect.type_descriptor(self.impl)

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        del dialect
        return value if value is None else value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        del dialect
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


# --- the exact numbers (ADR-lang-0015, synapsis.exact): a `bigint` column is the database's BIGINT, a `bigdouble` one
# its NUMERIC(p, s). SQLite would keep a REAL (and lose digits): there both keep the value's text, in a type whose name
# says it (`EXACT TEXT`, `EXACT TEXT(p,s)`: TEXT affinity), compared and sorted by value (`_ExactCompare`, `_ExactOrder`).


class _LiteExact(UserDefinedType[str]):
    """SQLite's column of an exact number: the value's text."""

    cache_ok = True

    def __init__(self, scale: int | None = None, precision: int | None = None) -> None:
        self.scale, self.precision = scale, precision

    def get_col_spec(self, **kw: Any) -> str:
        del kw
        return "EXACT TEXT" if self.scale is None else f"EXACT TEXT({self.precision},{self.scale})"


class _Exact(TypeDecorator[Any]):
    impl = Numeric
    cache_ok = True
    scale: int | None = None
    precision: int | None = None

    class comparator_factory(TypeDecorator.Comparator[Any]):  # noqa: N801 (SQLAlchemy's name)
        """By value on every database: on SQLite the text is compared by its sign, its length and its digits."""

        def operate(self, op: Any, *other: Any, **kw: Any) -> Any:
            kind = self.type
            if op in (operators.gt, operators.ge, operators.lt, operators.le) and other and other[0] is not None:
                return _ExactCompare(self.expr, op, other[0], kind)
            if op is operators.between_op:
                low, high = other[0], other[1]
                return and_(_ExactCompare(self.expr, operators.ge, low, kind), _ExactCompare(self.expr, operators.le, high, kind))
            if op in (operators.asc_op, operators.desc_op):
                return _ExactOrder(self.expr, op is operators.desc_op, kind)
            return super().operate(op, *other, **kw)

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "sqlite":
            return dialect.type_descriptor(_LiteExact(self.scale, self.precision))
        return dialect.type_descriptor(self.plain())

    def plain(self) -> Any:
        """The database's own type (BIGINT, NUMERIC(p, s))."""
        raise NotImplementedError

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return column_text(value, self.scale) if dialect.name == "sqlite" else self.value_of(value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        del dialect
        return None if value is None else self.value_of(value)

    def value_of(self, value: Any) -> Any:
        raise NotImplementedError


class ExactInteger(_Exact):
    """A `bigint` column: BIGINT (on SQLite its text)."""

    impl = BigInteger
    cache_ok = True

    @property
    def python_type(self) -> type:
        return int

    def plain(self) -> Any:
        return BigInteger()

    def value_of(self, value: Any) -> int:
        return int(value)


class ExactDecimal(_Exact):
    """A `bigdouble` column: NUMERIC(precision, scale), DECIMAL on MySQL and MariaDB (on SQLite its text with `scale`
    decimals)."""

    impl = Numeric
    cache_ok = True

    def __init__(self, precision: int = PRECISION, scale: int = SCALE) -> None:
        if not 1 <= precision <= MAX_PRECISION or not 0 <= scale <= min(MAX_SCALE, precision):
            raise ValueError(
                f"a bigdouble column has a precision from 1 to {MAX_PRECISION} and a scale from 0 to {MAX_SCALE}, at most the precision"
                f" (precision = {precision}, scale = {scale})"
            )
        super().__init__(precision, scale, asdecimal=True)
        self.precision, self.scale = precision, scale

    @property
    def python_type(self) -> type:
        return Decimal

    def plain(self) -> Any:
        return Numeric(self.precision, self.scale, asdecimal=True)

    def value_of(self, value: Any) -> Decimal:
        return value if isinstance(value, Decimal) else Decimal(str(value))


def _lite_parts(column: Any, kind: _Exact) -> tuple[Any, Any, Any]:
    """SQLite: the text of the column, whether it is negative, and its key by size: the digits before the point,
    negative for a negative value (`-12.50` → -2), so that only values of the same sign and size compare by text."""
    t = type_coerce(column, Text())
    after = 0 if not kind.scale else kind.scale + 1
    negative = func.substr(t, 1, 1) == "-"
    size = case((negative, (1 + after) - func.length(t)), else_=func.length(t) - after)
    return t, negative, size


class _ExactCompare(ColumnElement[bool]):
    """`column <op> value` of an exact column, by value."""

    inherit_cache = False
    type = Boolean()

    def __init__(self, column: Any, op: Any, value: Any, kind: _Exact) -> None:
        self.column, self.op, self.value, self.kind = column, op, value, kind


@compiles(_ExactCompare)
def _compare(element: _ExactCompare, compiler: Any, **kw: Any) -> str:
    plain = element.kind.plain()
    return "(" + str(compiler.process(element.op(type_coerce(element.column, plain), literal(element.kind.value_of(element.value), plain)), **kw)) + ")"


@compiles(_ExactCompare, "sqlite")
def _compare_lite(element: _ExactCompare, compiler: Any, **kw: Any) -> str:
    t, _, size = _lite_parts(element.column, element.kind)
    value = element.kind.value_of(element.value)
    written = column_text(value, element.kind.scale)
    negative = written.startswith("-")
    digits = len(written.lstrip("-").split(".")[0])
    key = -digits if negative else digits
    op = element.op
    # of the same sign and size the texts sort as the values; a negative one the other way
    if negative:
        op = {operators.gt: operators.lt, operators.ge: operators.le, operators.lt: operators.gt, operators.le: operators.ge}[op]
    strict = {operators.ge: operators.gt, operators.le: operators.lt}.get(element.op, element.op)
    by_text = op(t, literal(written, Text()))
    # (in parentheses: the statement may AND it, or compare it with true)
    return "(" + str(compiler.process(or_(strict(size, key), and_(size == key, by_text)), **kw)) + ")"


class _ExactOrder(ColumnElement[Any]):
    """`orderBy` of an exact column, by value."""

    inherit_cache = False

    def __init__(self, column: Any, desc: bool, kind: _Exact) -> None:
        self.column, self.desc, self.kind = column, desc, kind
        self.type = kind


@compiles(_ExactOrder)
def _order(element: _ExactOrder, compiler: Any, **kw: Any) -> str:
    c = type_coerce(element.column, element.kind.plain())
    return str(compiler.process(c.desc() if element.desc else c.asc(), **kw))


@compiles(_ExactOrder, "sqlite")
def _order_lite(element: _ExactOrder, compiler: Any, **kw: Any) -> str:
    t, negative, size = _lite_parts(element.column, element.kind)
    positive_text = case((negative, None), else_=t)
    negative_text = case((negative, t), else_=None)
    keys = [size.asc(), positive_text.asc(), negative_text.desc()]
    if element.desc:
        keys = [size.desc(), positive_text.desc(), negative_text.asc()]
    return ", ".join(str(compiler.process(k, **kw)) for k in keys)


class Entity(AsyncAttrs, DeclarativeBase):
    """The base of every entity (a table). `entity.to_dict()` gives its columns and its loaded relations."""

    type_annotation_map = {datetime: UtcDateTime(), str: String(TEXT_LENGTH), BigInt: ExactInteger(), BigDouble: ExactDecimal()}
    # what the database writes (a default, @created, @updated) is read back with the write: the row an use case
    # answers is complete on every database, with or without RETURNING
    __mapper_args__ = {"eager_defaults": True}
    # SQLite: a generated key is never given again after its row is removed, as on the other databases
    __table_args__ = {"sqlite_autoincrement": True}

    def __setattr__(self, key: str, value: Any) -> None:
        # a list given to a @manyToMany that was not loaded (`order.tags = tags` on a found row): SQLAlchemy would have
        # to read the old list first, which it cannot do here; it is kept for `save`, which writes the join table
        relation = self.__mapper__.relationships.get(key)
        if relation is not None and relation.secondary is not None:
            state = inspect(self)
            if state.key is not None and key in state.unloaded:
                state.dict.setdefault(PENDING, {})[key] = value
                return
        super().__setattr__(key, value)

    def __init_subclass__(cls, **kw: Any) -> None:
        # the join column of a @manyToOne / @oneToOne gets its foreign key once the table exists
        keys = [v.info["fk"] for v in list(cls.__dict__.values()) if isinstance(v, RelationshipProperty) and "fk" in v.info]
        super().__init_subclass__(**kw)
        table: Table = getattr(cls, "__table__")
        for column_name, ref, on_delete in keys:
            table.append_constraint(ForeignKeyConstraint([column_name], [ref], ondelete=on_delete))

    def to_dict(self, _seen: set[int] | None = None) -> dict[str, Any]:
        seen = (_seen or set()) | {id(self)}
        out = {c.key: getattr(self, c.key) for c in self.__mapper__.column_attrs}
        unloaded = inspect(self).unloaded
        for r in self.__mapper__.relationships:
            if r.key in unloaded:
                continue
            v = getattr(self, r.key)
            if isinstance(v, list):
                out[r.key] = [x.to_dict(seen) for x in v if id(x) not in seen]  # type: ignore[union-attr]
            elif v is None or id(v) not in seen:
                out[r.key] = v.to_dict(seen) if v is not None else None
        return out


def primary(length: int | None = None, generated: bool = False, uuid_key: bool = False) -> Any:
    """The primary key: given by the app (a code), or `generated` (auto increment; with `uuid_key`, a uuid text)."""
    if generated and uuid_key:
        return mapped_column(String(length or 36), primary_key=True, default=lambda: str(uuid.uuid4()))
    if generated:
        return mapped_column(primary_key=True, autoincrement=True)
    # without a length the field's type decides (a text: TEXT_LENGTH)
    return mapped_column(String(length), primary_key=True) if length else mapped_column(primary_key=True)


def column(
    length: int | None = None,
    nullable: bool | None = None,
    unique: bool = False,
    index: bool = False,
    default: Any = None,
    name: str | None = None,
    precision: int | None = None,
    scale: int | None = None,
) -> Any:
    """A column. Its SQL type comes from the field's type (str, int, float, bool, datetime...); a `bigdouble` takes
    `precision` and `scale` (30 and 10 by default)."""
    args: list[Any] = [name] if name else []
    if length:
        args.append(String(length))
    if precision is not None or scale is not None:
        args.append(ExactDecimal(PRECISION if precision is None else precision, SCALE if scale is None else scale))
    kw: dict[str, Any] = {"unique": unique, "index": index}
    if nullable is not None:
        kw["nullable"] = nullable
    if default is not None:
        kw["default"] = default
        sql = _sql_literal(default if not isinstance(default, Decimal) else Decimal(column_text(default, SCALE if scale is None else scale)))
        if sql is not None:
            # also the database's default: a migration that adds the column to a table with rows needs it
            kw["server_default"] = text(sql)
    return mapped_column(*args, **kw)


def _sql_literal(value: Any) -> str | None:
    """`value` as SQL every database reads the same (true/false, numbers, quoted text); None for other values."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int | float):
        return repr(value)
    if isinstance(value, Decimal):
        # an exact decimal as its text: every database reads it as the column's number, SQLite keeps it as it is
        return "'" + format(value, "f") + "'"
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return None


# the database's clock as the default of a column, written the one way the four databases take for a column with a
# fraction (MySQL refuses CURRENT_TIMESTAMP without the parentheses there): what a row written by SQL gets
CLOCK = "(CURRENT_TIMESTAMP)"


def _clock(context: Any) -> datetime:
    """The app's clock to the millisecond, as every dialect writes @created and @updated (the database's clock has
    whole seconds on SQLite and MySQL); one instant per statement, so a new row's two are the same."""
    now: datetime | None = getattr(context, "_synapsis_now", None)
    if now is None:
        t = datetime.now(UTC)
        now = t.replace(microsecond=t.microsecond - t.microsecond % 1000)
        context._synapsis_now = now
    return now


def created() -> Any:
    """When the row was inserted: never empty, written by the app with its milliseconds (ADR-backend-0002)."""
    return mapped_column(UtcDateTime(), default=_clock, server_default=text(CLOCK), nullable=False, info={"clock": True})


def updated() -> Any:
    """When the row last changed: never empty, written by the app with its milliseconds, again with every change."""
    return mapped_column(
        UtcDateTime(), default=_clock, onupdate=_clock, server_default=text(CLOCK), nullable=False, info={"clock": True}
    )


_ACTIONS = {"cascade": "CASCADE", "set null": "SET NULL", "restrict": "RESTRICT", "no action": "NO ACTION"}


def _registered(name: str) -> Any:
    return Entity.registry._class_registry[name]  # type: ignore[attr-defined]


def many_to_one(owner: str, column_name: str, ref: str, inverse: str | None = None, on_delete: str | None = None) -> Any:
    """`@manyToOne project?: Project` + `projectId`: the row this one points to by its column (`ref`: table.key)."""
    return relationship(
        foreign_keys=f"{owner}.{column_name}",
        back_populates=_snake(inverse) if inverse else None,
        lazy="raise",
        info={"fk": (column_name, ref, _ACTIONS.get(on_delete or "", None))},
    )


def one_to_many(target: str, inverse: str, one: bool = False) -> Any:
    """`@oneToMany(inverse = "project") tasks?: Task[]`: the rows of `target` that point to this one."""
    back = _snake(inverse)
    # passive_deletes: removing this row leaves its rows to the database's ON DELETE (as sequelize does)
    return relationship(
        foreign_keys=f"{target}.{back}_id", back_populates=back, lazy="raise", uselist=not one, passive_deletes=True
    )


def one_to_one(
    owner: str, target: str, column_name: str = "", ref: str = "", inverse: str | None = None, on_delete: str | None = None
) -> Any:
    """`@oneToOne`: the @joinColumn side keeps the column (`column_name`, `ref`: table.key); the other side reads it."""
    if column_name:
        rel = many_to_one(owner, column_name, ref, inverse, on_delete)
        rel.uselist = False
        return rel
    return one_to_many(target, inverse or "", one=True)


# the join tables of the @manyToMany relations: (owner class, field) → the table, made when the mappers are configured
_joins: dict[tuple[str, str], Callable[[], Table]] = {}


def many_to_many(owner: str, field: str, target: str, inverse: str | None = None, join: bool = False) -> Any:
    """`@manyToMany tags?: Tag[]`; the side with `@joinTable` (`join`) owns the table `<owner table>_<field>`, whose
    columns are `<owner>_id` and `<target>_id`."""
    if join:
        def make() -> Table:
            o, t = _registered(owner), _registered(target)
            name = f"{o.__tablename__}_{field}"
            if name in Entity.metadata.tables:
                return Entity.metadata.tables[name]
            ok, tk = list(o.__table__.primary_key)[0], list(t.__table__.primary_key)[0]
            return Table(
                name,
                Entity.metadata,
                Column(f"{_snake(owner)}_id", ForeignKey(f"{o.__tablename__}.{ok.name}", ondelete="CASCADE"), primary_key=True),
                Column(f"{_snake(target)}_id", ForeignKey(f"{t.__tablename__}.{tk.name}", ondelete="CASCADE"), primary_key=True),
            )

        _joins[(owner, _snake(field))] = make
        secondary: Callable[[], Table] = make
    else:
        secondary = lambda: _joins[(target, _snake(inverse or ""))]()  # noqa: E731
    return relationship(secondary=secondary, back_populates=_snake(inverse) if inverse else None, lazy="raise")


class EntitySchema(BaseModel):
    """The pydantic model of an entity: a relation that was not loaded is left out of the answer (not null); its JSON
    has Nuclear's names (`projectId`, synapsis.models)."""

    model_config = WIRE
    relations: ClassVar[frozenset[str]] = frozenset()

    @classmethod
    def __get_pydantic_core_schema__(cls, source: type[BaseModel], handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        # a body that is an entity is typed as a model is (synapsis.models)
        return typed(handler(source))

    @model_serializer(mode="wrap")
    def _loaded_only(self, handler: SerializerFunctionWrapHandler, info: SerializationInfo) -> Any:
        data = wire_dates(self, handler(self), info)
        if isinstance(data, dict):
            for r in self.relations - self.model_fields_set:
                data.pop(to_camel(r), None)  # type: ignore[union-attr]
        return data


_schemas: dict[tuple[type, bool], type[BaseModel]] = {}


def schema_of(entity: type[Entity], create: bool = False) -> type[BaseModel]:
    """The pydantic model of an entity (what a controller reads and answers). `create`: without the columns the
    database fills (generated keys, timestamps), for the body of a POST."""
    key = (entity, create)
    if key not in _schemas:
        fields: dict[str, Any] = {}
        for col in entity.__table__.columns:
            # a column with a literal default (column(default=...)) also has it as the SQL default, but the client
            # may still give it
            # (a @created / @updated has the app's clock as its default too: still not the client's)
            server_filled = (col.server_default is not None and (col.default is None or "clock" in col.info)) or (
                col.primary_key and (col.autoincrement is True or col.default is not None)
            )
            if create and server_filled:
                continue
            try:
                py: Any = col.type.python_type
            except NotImplementedError:
                py = Any
            # an exact column is a text in JSON (synapsis.exact)
            if isinstance(col.type, ExactInteger):
                py = BigInt
            elif isinstance(col.type, ExactDecimal):
                py = BigDouble
            if py is datetime and server_filled:
                py = datetime | None
            optional = col.nullable and not col.primary_key
            fields[col.key] = (py | None, None) if optional else (py, ...)
        relations = frozenset() if create else frozenset(r.key for r in entity.__mapper__.relationships)
        for r in relations:
            fields[r] = (Any, None)
        model = create_model(f"{entity.__name__}{'Create' if create else ''}", __base__=EntitySchema, **fields)
        model.relations = relations
        _schemas[key] = model
    return _schemas[key]


def wire_of(entity: Entity, _seen: set[int] | None = None) -> BaseModel:
    """`entity` as the answer of a route: its schema, and the schema of every related row that was loaded (their JSON
    has Nuclear's names too); a relation that was not loaded is left out, never fetched."""
    seen = (_seen or set()) | {id(entity)}
    data: dict[str, Any] = {c.key: getattr(entity, c.key) for c in entity.__mapper__.column_attrs}
    unloaded = inspect(entity).unloaded
    for r in entity.__mapper__.relationships:
        if r.key in unloaded:
            continue
        v = getattr(entity, r.key)
        if isinstance(v, list):
            rows = cast(list[Entity], v)
            data[r.key] = [wire_of(x, seen) for x in rows if id(x) not in seen]
        elif v is None or id(v) not in seen:
            data[r.key] = wire_of(v, seen) if v is not None else None
    return schema_of(type(entity)).model_validate(data)
