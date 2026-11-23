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
  BuildOptions, FindOptions, IncludeOptions, Model as SequelizeModel, ModelStatic, Op, Order, Transaction, WhereOptions, col, fn,
  literal, where as whereOf,
} from 'sequelize';
import { BelongsToManyOptions, Model, ModelCtor, Sequelize } from 'sequelize-typescript';
import { limits } from './edge.js';
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

// the transaction of the running @transactional call, and the database the repositories use
const running = new AsyncLocalStorage<Transaction>();
let database: Sequelize | undefined;

/** The options of a call inside the running transaction (none outside one). */
function inTransaction(): { transaction?: Transaction } {
  const t = running.getStore();
  return t ? { transaction: t } : {};
}

/**
 * `@transactional` on a use case's `exec`: its repository calls share one transaction of the default database; an
 * `Err` or an error rolls it back, an `Ok` commits it. A call inside another transactional call joins it.
 */
export function transactional(_target: object, _key: string | symbol, descriptor: PropertyDescriptor): void {
  const fn = descriptor.value as (...args: unknown[]) => Promise<unknown>;
  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    if (running.getStore() || !database) return fn.apply(this, args);
    const t = await database.transaction();
    try {
      const result = await running.run(t, () => fn.apply(this, args));
      if (result instanceof Result && result.isErr) await t.rollback();
      else await t.commit();
      return result;
    } catch (e) {
      await t.rollback();
      throw e;
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
    if (v instanceof Contains) {
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

/** A text longer than its column (`@column(length = n)`; 255 without one) is refused before it is written, with the
 * 409 of what a database refuses for integrity: PostgreSQL, MySQL and MariaDB refuse it in a VARCHAR, SQLite and a
 * text type would keep it. The length is counted in characters (code points), as the databases count it. */
function fits(model: ModelCtor<Model>, values: Record<string, unknown>): void {
  for (const [name, a] of Object.entries(model.getAttributes())) {
    const v = values[name];
    const { key, options } = a.type as { key?: string; options?: { length?: number } };
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
  private orders: [string, string][] = [];
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
