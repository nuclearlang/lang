// Repositories: the table of one entity through Sequelize. Queries read like TypeORM's query builder:
//   where({ userId: id })        equality, or an operator: { age: gt(18) }, { name: like('Ri%') }
//   orderBy('name')              orderBy('name', { desc: true }) = descending (Nuclear: orderBy("name", desc = true))
//   relations('tasks')           load a relation (ADR-backend-0001); 'tasks.tags' loads one of its relations too
//   getOne()                     Ok(entity) or Err(NotFound)
//   paginate(page, size)         Page(items, page, size, total, pages)
// Every method of a `repository` writes on its own query (`q`), so two calls never share state. Inside a
// `@transactional` method every call joins one transaction of the default database.
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  BuildOptions, DatabaseError, FindOptions, IncludeOptions, Model as SequelizeModel, ModelStatic, Op, Order, Transaction, WhereOptions, col, fn,
  literal, where as whereOf,
} from 'sequelize';
import { BelongsToManyOptions, Model, ModelCtor, Sequelize } from 'sequelize-typescript';
import { connections } from './app.js';
import { Database } from './config.js';
import { limits } from './edge.js';
import { BIGINT_MAX, BIGINT_MIN, BigDouble, columnText, fitsBigDouble, isBigDouble } from './exact.js';
import { Conflict, NotFound } from './errors.js';
import { Err, Ok, Result } from './result.js';

/**
 * The base of every entity (a table): a related row or list given when it is made (`new Task({ tags })`) is kept
 * for `save`, as SQLAlchemy keeps it (sequelize drops what is not a column).
 */
export class Entity extends Model {
  constructor(values?: Record<string, unknown>, options?: BuildOptions) {
    super(values, options);
    if (!values || options?.isNewRecord === false) return;
    const associations = (this.constructor as typeof Model).associations ?? {};
    for (const name of Object.keys(associations)) {
      if (name in values) (this as unknown as Record<string, unknown>)[name] = values[name];
    }
  }

  /** The row as JSON, its columns in the entity's order (Sequelize puts a column with a getter, an exact one, first). */
  override toJSON<T extends object>(): T {
    const plain = super.toJSON() as Record<string, unknown>;
    const order = Object.keys((this.constructor as ModelCtor<Model>).getAttributes());
    return Object.fromEntries([...order.filter((k) => k in plain).map((k) => [k, plain[k]]), ...Object.entries(plain).filter(([k]) => !order.includes(k))]) as T;
  }
}

/**
 * The type of a `@manyToOne` / `@oneToOne` field: `T` itself. Two entities import each other, and an alias keeps
 * TypeScript's decorator metadata from reading the other class before its module has run.
 */
export type Related<T> = T;

/** One page of a query: `items`, `page` (from 1), `size`, `total` rows and `pages`. */
export class Page<T> {
  constructor(
    readonly items: T[],
    readonly page: number,
    readonly size: number,
    readonly total: number,
    readonly pages: number,
  ) {}
}

// the transaction of the running @transactional call and what waits for its commit (the events it publishes), and
// the database the repositories use
type Running = { transaction: Transaction; waiting: (() => Promise<void>)[] };
const running = new AsyncLocalStorage<Running>();
let database: Sequelize | undefined;

/** The options of a call inside the running transaction (none outside one). */
function inTransaction(): { transaction?: Transaction } {
  const r = running.getStore();
  return r ? { transaction: r.transaction } : {};
}

/** A transaction the database asks to run again is run again this many times (ADR-backend-0004), then its error goes;
 * a database's plugin may set its own (`Database.retries`). */
export const RETRIES = 3;
// SQLSTATE of a serialization failure and of a deadlock (PostgreSQL's code, MySQL's and MariaDB's sqlState)
const RETRY_STATES = new Set(['40001', '40P01']);
// MySQL's and MariaDB's number of a deadlock, when the driver gives no state
const RETRY_NUMBERS = new Set([1213]);

/** The database refused the transaction only because of another one running at the same time: running it again may
 * succeed. Any other error is not retried. */
export function mustRetry(e: unknown): boolean {
  if (!(e instanceof DatabaseError)) return false;
  const { code, sqlState, errno } = (e.original ?? {}) as { code?: string; sqlState?: string; errno?: number };
  return RETRY_STATES.has(String(sqlState ?? code)) || (errno !== undefined && RETRY_NUMBERS.has(errno));
}

/** Inside `@transactional`, keeps `send` for the commit (dropped by a rollback, never run twice by a retry) and
 * answers true; outside one answers false and the caller sends at once. */
export function afterCommit(send: () => Promise<void>): boolean {
  const r = running.getStore();
  if (!r) return false;
  r.waiting.push(send);
  return true;
}

/**
 * `@transactional` on a use case's `exec`: its repository calls share one transaction of the default database; an
 * `Err` or an error rolls it back, an `Ok` commits it. A call inside another transactional call joins it. A
 * transaction the database asks to run again (`mustRetry`) runs again from its start, `RETRIES` times; the events
 * published inside are sent once, after the commit.
 */
export function transactional(_target: object, _key: string | symbol, descriptor: PropertyDescriptor): void {
  const fn = descriptor.value as (...args: unknown[]) => Promise<unknown>;
  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    if (running.getStore() || !database) return fn.apply(this, args);
    const limit = connections().find((c): c is Database => c instanceof Database && c.name === 'default')?.retries ?? RETRIES;
    for (let attempt = 0; ; attempt++) {
      const t = await database.transaction();
      const waiting: (() => Promise<void>)[] = [];
      let result: unknown;
      let failed = false;
      try {
        result = await running.run({ transaction: t, waiting }, () => fn.apply(this, args));
        failed = result instanceof Result && result.isErr;
        if (failed) await t.rollback();
        else await t.commit();
      } catch (e) {
        await t.rollback();
        if (attempt < limit && mustRetry(e)) continue;
        throw e;
      }
      if (!failed) for (const send of waiting) await send();
      return result;
    }
  };
}

/**
 * The options of a `@manyToMany`: the join table `name` with only its two columns (no timestamps, as SQLAlchemy's),
 * `foreignKey` pointing to this side and `otherKey` to the other.
 */
export function joinTable(name: string, foreignKey: string, otherKey: string): BelongsToManyOptions<object, object> {
  return { through: name, foreignKey, otherKey, timestamps: false } as BelongsToManyOptions<object, object>;
}

/** `['tasks.tags', 'owner']` → the nested includes of sequelize; the rows of a `@manyToMany` come without their row
 * of the join table (the answer has the related rows only, as in every dialect). */
function includes(model: ModelStatic<SequelizeModel>, paths: string[]): IncludeOptions[] {
  const byRoot = new Map<string, string[]>();
  for (const p of paths) {
    const [root, ...rest] = p.split('.');
    const list = byRoot.get(root) ?? [];
    if (rest.length) list.push(rest.join('.'));
    byRoot.set(root, list);
  }
  return [...byRoot].map(([association, inner]) => {
    const found = model.associations[association];
    if (!found) throw new Error(`${model.name} has no relation '${association}'`);
    return {
      association,
      ...(found.associationType === 'BelongsToMany' ? { through: { attributes: [] } } : {}),
      ...(inner.length ? { include: includes(found.target, inner) } : {}),
    };
  });
}

/** A comparison of `where` other than equality; `anyCase`: a `like` that ignores the case (`ilike`). */
export class Operator {
  constructor(readonly value: Record<symbol, unknown>, readonly anyCase?: string) {}
}

export const gt = (v: unknown) => new Operator({ [Op.gt]: v });
export const gte = (v: unknown) => new Operator({ [Op.gte]: v });
export const lt = (v: unknown) => new Operator({ [Op.lt]: v });
export const lte = (v: unknown) => new Operator({ [Op.lte]: v });
export const ne = (v: unknown) => new Operator({ [Op.ne]: v });
export const like = (pattern: string) => new Operator({ [Op.like]: pattern });
/** How `orderBy` sorts: Nuclear's named argument `desc = true` arrives as `{ desc: true }` (a boolean is accepted too). */
export type SortOrder = { desc?: boolean } | boolean;

// `ilike` is the platform's word (nuclear-synapsis-framework/platforms/backend/docs/07-reference/backend.md), the same in every backend dialect
// (only PostgreSQL has an ILIKE: on the others it is written lower(column) LIKE lower(pattern), as SQLAlchemy does)
export const ilike = (pattern: string) => new Operator({ [Op.iLike]: pattern }, pattern);
/** `contains` and `icontains`: the rows whose column holds `text` as it is. Its `%`, `_` and `/` (the escape) are
 * characters, never wildcards: `LIKE '%' || text || '%' ESCAPE '/'`, as SQLAlchemy's `contains(autoescape)` writes
 * it, so both dialects ask the same SQL. `contains` has `like`'s case (the database's); `icontains` ignores it on
 * every database (PostgreSQL's ILIKE, lower() on both sides elsewhere). */
export class Contains {
  constructor(readonly text: string, readonly anyCase: boolean) {}
}
export const contains = (text: string) => new Contains(text, false);
export const icontains = (text: string) => new Contains(text, true);
export const oneOf = (values: unknown[]) => new Operator({ [Op.in]: values });
export const isNull = (isNullValue = true) => new Operator(isNullValue ? { [Op.is]: null } : { [Op.not]: null });
export const between = (low: unknown, high: unknown) => new Operator({ [Op.between]: [low, high] });

type Conditions = Record<string, unknown>;

/** An exact column (ADR-lang-0015): a `bigint` is a BIGINT; a `bigdouble` a DECIMAL with its scale. */
function exactOf(model: ModelCtor<Model>, field: string): { scale?: number; precision?: number } | undefined {
  const { key, options } = (model.getAttributes()[field]?.type ?? {}) as { key?: string; options?: { precision?: number; scale?: number } };
  if (key === 'BIGINT') return {};
  if (key === 'DECIMAL') return { scale: options?.scale ?? 0, precision: options?.precision ?? 0 };
  return undefined;
}

const exactValue = (v: unknown): v is bigint | BigDouble => typeof v === 'bigint' || isBigDouble(v);

/** A value compared with an exact column: its text, as SQL's number (PostgreSQL, MySQL and MariaDB compare a quoted
 * text with a DECIMAL as a double) or, on SQLite, as the text the column keeps. The text is only digits, a sign and a
 * point (columnText). */
function exactSql(v: unknown, exact: { scale?: number }, lite: boolean): unknown {
  if (!exactValue(v)) return v;
  const text = columnText(v, exact.scale);
  return lite ? text : literal(text);
}

/** SQLite: `column <op> value` of an exact column, by value. The column keeps the value's text with its scale's
 * decimals: of the same sign and the same digits before the point, the texts sort as the values (a negative one the
 * other way); the digits before the point decide the rest (the same SQL as synapsis.orm's). */
function liteCompare(column: string, op: symbol, v: bigint | BigDouble, exact: { scale?: number }, escape: (s: string) => string): string {
  const text = columnText(v, exact.scale);
  const negative = text.startsWith('-');
  const digits = text.replace(/^-/, '').split('.')[0]!.length;
  const key = negative ? -digits : digits;
  const ops: Record<symbol, string> = { [Op.gt]: '>', [Op.gte]: '>=', [Op.lt]: '<', [Op.lte]: '<=' };
  const flip: Record<string, string> = { '>': '<', '>=': '<=', '<': '>', '<=': '>=' };
  const sign = ops[op]!;
  const strict = sign.replace('=', '');
  return `(${liteSize(column, exact)} ${strict} ${key} OR (${liteSize(column, exact)} = ${key} AND ${column} ${negative ? flip[sign] : sign} ${escape(text)}))`;
}

/** SQLite: the digits before the point of an exact column's text, negative for a negative value. */
function liteSize(column: string, exact: { scale?: number }): string {
  const after = exact.scale ? exact.scale + 1 : 0;
  return `CASE WHEN (substr(${column}, 1, 1) = '-') THEN ${1 + after} - length(${column}) ELSE length(${column}) - ${after} END`;
}

/** SQLite: the terms of `orderBy` of an exact column, by value. */
function liteOrder(column: string, exact: { scale?: number }, desc: boolean): [ReturnType<typeof literal>, string][] {
  const negative = `substr(${column}, 1, 1) = '-'`;
  const [up, down] = desc ? ['DESC', 'ASC'] : ['ASC', 'DESC'];
  return [
    [literal(liteSize(column, exact)), up],
    [literal(`CASE WHEN (${negative}) THEN NULL ELSE ${column} END`), up],
    [literal(`CASE WHEN (${negative}) THEN ${column} END`), down],
  ];
}

/** `values` of a write with each exact value as the text its column keeps (what the field's setter writes). */
function exactValues(model: ModelCtor<Model>, values: Record<string, unknown>): Record<string, unknown> {
  const out = { ...values };
  for (const [k, v] of Object.entries(values)) {
    const exact = exactOf(model, k);
    if (exact && exactValue(v)) out[k] = columnText(v, exact.scale);
  }
  return out;
}

/** A field of `where` or `orderBy` that is not a column of the entity: the program's error, a 500 that says it. */
export class InvalidField extends Error {
  override name = 'InvalidField';
}

/** `field` if it is a column of `model` (never a relation or a property of the class). */
function column(model: ModelCtor<Model>, field: string): string {
  // (the name is not in the message: it may be a client's text, and the log never holds one)
  if (!Object.hasOwn(model.getAttributes(), field)) throw new InvalidField(`${model.name} has no column of that name`);
  return field;
}

/** `conditions` as sequelize's; `aliased`: the query names its table by the model (a read), so a column is told
 * apart from a loaded relation's. */
function toWhere(model: ModelCtor<Model>, conditions: Conditions[], aliased: boolean): WhereOptions {
  const all: WhereOptions[] = [];
  for (const [k, v] of conditions.flatMap((c) => Object.entries(c))) {
    const exact = exactOf(model, k);
    if (exact) {
      all.push(exactWhere(model, k, v, exact, aliased));
    } else if (v instanceof Contains) {
      const name = model.getAttributes()[k]?.field ?? k;
      const target = col(aliased ? `${model.name}.${name}` : name);
      // the value is quoted by sequelize's own escape, as it quotes every value of a where
      const text = model.sequelize!.escape(`%${v.text.replace(/[/%_]/g, '/$&')}%`);
      const postgres = model.sequelize!.getDialect() === 'postgres';
      all.push(
        !v.anyCase ? whereOf(target, { [Op.like]: literal(`${text} ESCAPE '/'`) })
        : postgres ? whereOf(target, { [Op.iLike]: literal(`${text} ESCAPE '/'`) })
        : whereOf(fn('lower', target), { [Op.like]: literal(`lower(${text}) ESCAPE '/'`) }),
      );
    } else if (v instanceof Operator && v.anyCase !== undefined && model.sequelize?.getDialect() !== 'postgres') {
      const column = model.getAttributes()[k]?.field ?? k;
      all.push(whereOf(fn('lower', col(aliased ? `${model.name}.${column}` : column)), { [Op.like]: v.anyCase.toLowerCase() }));
    } else {
      all.push({ [k]: v instanceof Operator ? v.value : v });
    }
  }
  return all.length ? { [Op.and]: all } : {};
}

/** One condition of an exact column, by value on every database. */
function exactWhere(model: ModelCtor<Model>, k: string, v: unknown, exact: { scale?: number }, aliased: boolean): WhereOptions {
  const s = model.sequelize!;
  const lite = s.getDialect() === 'sqlite';
  if (!(v instanceof Operator)) return { [k]: exactSql(v, exact, lite) };
  const parts: WhereOptions[] = [];
  const generator = s.getQueryInterface().queryGenerator as unknown as { quoteIdentifier(n: string): string };
  const name = model.getAttributes()[k]?.field ?? k;
  const column = (aliased ? `${generator.quoteIdentifier(model.name)}.` : '') + generator.quoteIdentifier(name);
  for (const op of Object.getOwnPropertySymbols(v.value)) {
    const value = v.value[op];
    const ordered = op === Op.gt || op === Op.gte || op === Op.lt || op === Op.lte;
    if (lite && ordered && exactValue(value)) {
      parts.push(literal(liteCompare(column, op, value, exact, (t) => s.escape(t))));
    } else if (lite && op === Op.between && Array.isArray(value) && value.every(exactValue)) {
      parts.push(literal(liteCompare(column, Op.gte, value[0], exact, (t) => s.escape(t))));
      parts.push(literal(liteCompare(column, Op.lte, value[1], exact, (t) => s.escape(t))));
    } else {
      const written = Array.isArray(value) ? value.map((x) => exactSql(x, exact, lite)) : exactSql(value, exact, lite);
      parts.push({ [k]: { [op]: written } });
    }
  }
  return parts.length === 1 ? parts[0]! : { [Op.and]: parts };
}

/** A text longer than its column (`@column(length = n)`; 255 without one) is refused before it is written, with the
 * 409 of what a database refuses for integrity: PostgreSQL, MySQL and MariaDB refuse it in a VARCHAR, SQLite and a
 * text type would keep it. The length is counted in characters (code points), as the databases count it. */
function fits(model: ModelCtor<Model>, values: Record<string, unknown>): void {
  for (const [name, a] of Object.entries(model.getAttributes())) {
    const v = values[name];
    const { key, options } = a.type as { key?: string; options?: { length?: number; precision?: number; scale?: number } };
    // an exact number the column cannot hold (beyond 64 bits; more digits or decimals than it has): never rounded
    if (key === 'BIGINT' && (typeof v === 'string' || typeof v === 'bigint')) {
      const n = BigInt(v);
      if (n < BIGINT_MIN || n > BIGINT_MAX) throw new Conflict();
      continue;
    }
    if (key === 'DECIMAL' && (typeof v === 'string' || isBigDouble(v))) {
      if (!fitsBigDouble(isBigDouble(v) ? v : BigDouble.of(v), options?.precision ?? 0, options?.scale ?? 0)) throw new Conflict();
      continue;
    }
    if (key !== 'STRING' || typeof v !== 'string') continue;
    const max = options?.length ?? 255;
    // a text has at most as many characters as UTF-16 units: only a longer one is counted
    if (v.length > max && [...v].length > max) throw new Conflict();
  }
}

/** The data of one entity: CRUD without writing it (find, findAll, save, remove) and a query builder. */
export class Repository<T extends Model> {
  constructor(readonly model: ModelCtor<T>) {
    // shortcut: the transaction opens on the database of the last repository made (the app's default one); an
    // app with two SQL databases needs `@transactional` to name its database.
    database = (model.sequelize as Sequelize | undefined) ?? database;
  }

  query(): Query<T> {
    return new Query(this);
  }

  async find(id: unknown): Promise<Result<NotFound, T>> {
    const found = await this.model.findByPk(id as string | number, inTransaction());
    return found ? Ok(found) : Err(new NotFound(`${this.model.name} ${String(id)} not found`));
  }

  findAll(): Promise<T[]> {
    return this.query().getMany();
  }

  /** Writes the row; a `@manyToOne` set to a row gives its column, a `@manyToMany` list set writes the join table. */
  async save(entity: T): Promise<T> {
    const related = (name: string): unknown => (entity as unknown as Record<string, unknown>)[name] ?? entity.dataValues[name];
    for (const [name, a] of Object.entries(this.model.associations)) {
      const v = related(name);
      if (a.associationType === 'BelongsTo' && v instanceof Model && entity.get(a.foreignKey) == null) {
        entity.set(a.foreignKey, v.get((a as unknown as { targetKey: string }).targetKey));
      }
    }
    fits(this.model as ModelCtor<Model>, entity.dataValues as Record<string, unknown>);
    const saved = await entity.save(inTransaction());
    // a column the insert did not name is null in the database: the row says so (sequelize leaves it undefined, and
    // the JSON answer would lack it), as a row that was read does
    for (const name of Object.keys(this.model.getAttributes())) {
      if (saved.dataValues[name] === undefined) saved.dataValues[name] = null;
    }
    for (const [name, a] of Object.entries(this.model.associations)) {
      const v = related(name);
      if (a.associationType === 'BelongsToMany' && Array.isArray(v)) await saved.$set(name as never, v, inTransaction());
    }
    return saved;
  }

  async remove(id: unknown): Promise<boolean> {
    const where = { [this.model.primaryKeyAttribute]: id } as WhereOptions;
    return (await this.model.destroy({ where, ...inTransaction() })) > 0;
  }

  where(conditions: Conditions): Query<T> {
    return this.query().where(conditions);
  }

  orderBy(field: string, order: SortOrder = {}): Query<T> {
    return this.query().orderBy(field, order);
  }

  limit(n: number): Query<T> {
    return this.query().limit(n);
  }

  offset(n: number): Query<T> {
    return this.query().offset(n);
  }

  relations(...names: string[]): Query<T> {
    return this.query().relations(...names);
  }

  paginate(page: number, size = 20): Promise<Page<T>> {
    return this.query().paginate(page, size);
  }

  getOne(): Promise<Result<NotFound, T>> {
    return this.query().getOne();
  }

  getMany(): Promise<T[]> {
    return this.query().getMany();
  }

  count(): Promise<number> {
    return this.query().count();
  }

  exists(): Promise<boolean> {
    return this.query().exists();
  }
}

/** One query of a repository: where / orderBy / limit / offset add to it; the others run it. */
export class Query<T extends Model> {
  private conditions: Conditions[] = [];
  private orders: ([string, string] | [ReturnType<typeof literal>, string])[] = [];
  private max?: number;
  private skip?: number;
  private loads: string[] = [];

  constructor(readonly repo: Repository<T>) {}

  where(conditions: Conditions): Query<T> {
    for (const k of Object.keys(conditions)) column(this.repo.model, k);
    this.conditions.push(conditions);
    return this;
  }

  orderBy(field: string, order: SortOrder = {}): Query<T> {
    const desc = typeof order === 'boolean' ? order : order.desc === true;
    const model = this.repo.model as ModelCtor<Model>;
    const exact = exactOf(model, column(model, field));
    if (exact && model.sequelize?.getDialect() === 'sqlite') {
      // an exact column sorts by value (its text does not)
      const generator = model.sequelize.getQueryInterface().queryGenerator as unknown as { quoteIdentifier(n: string): string };
      const name = generator.quoteIdentifier(model.name) + '.' + generator.quoteIdentifier(model.getAttributes()[field]?.field ?? field);
      this.orders.push(...liteOrder(name, exact, desc));
      return this;
    }
    this.orders.push([column(this.repo.model, field), desc ? 'DESC' : 'ASC']);
    return this;
  }

  limit(n: number): Query<T> {
    this.max = n;
    return this;
  }

  offset(n: number): Query<T> {
    this.skip = n;
    return this;
  }

  /** Loads these relations with the rows ('tasks', 'tasks.tags'); the others stay out of the answer. */
  relations(...names: string[]): Query<T> {
    this.loads.push(...names);
    return this;
  }

  private filter(aliased = true): WhereOptions {
    return toWhere(this.repo.model as ModelCtor<Model>, this.conditions, aliased);
  }

  private options(): FindOptions {
    return {
      where: this.filter(),
      order: this.orders as Order,
      ...(this.max !== undefined ? { limit: this.max } : {}),
      ...(this.skip !== undefined ? { offset: this.skip } : {}),
      ...(this.loads.length ? { include: includes(this.repo.model, this.loads) } : {}),
      ...inTransaction(),
    };
  }

  /** One page (from 1) of `size` rows, with the total of rows and of pages. */
  async paginate(page: number, size = 20): Promise<Page<T>> {
    page = Math.max(page, 1);
    // a page is never larger than the app's `maxPageSize` (as Spring Data's `max-page-size`): a larger size is
    // answered with that many rows, and the page says its size
    size = Math.min(Math.max(size, 1), limits.page);
    const total = await this.count();
    this.max = size;
    this.skip = (page - 1) * size;
    return new Page(await this.getMany(), page, size, total, Math.ceil(total / size));
  }

  async getOne(): Promise<Result<NotFound, T>> {
    const found = await this.repo.model.findOne(this.options());
    return found ? Ok(found) : Err(new NotFound(`${this.repo.model.name} not found`));
  }

  getMany(): Promise<T[]> {
    return this.repo.model.findAll(this.options());
  }

  count(): Promise<number> {
    return this.repo.model.count({ where: this.filter(), ...inTransaction() });
  }

  async exists(): Promise<boolean> {
    return (await this.count()) > 0;
  }

  async update(values: Record<string, unknown>): Promise<number> {
    values = exactValues(this.repo.model as ModelCtor<Model>, values);
    fits(this.repo.model as ModelCtor<Model>, values);
    const [n] = await this.repo.model.update(values as never, { where: this.filter(false), ...inTransaction() });
    return n;
  }

  delete(): Promise<number> {
    return this.repo.model.destroy({ where: this.filter(false), ...inTransaction() });
  }

  // CRUD of the repository, so a repository method can use them on its query
  find(id: unknown): Promise<Result<NotFound, T>> {
    return this.repo.find(id);
  }

  findAll(): Promise<T[]> {
    return this.repo.findAll();
  }

  save(entity: T): Promise<T> {
    return this.repo.save(entity);
  }

  remove(id: unknown): Promise<boolean> {
    return this.repo.remove(id);
  }
}
