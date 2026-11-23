#!/usr/bin/env node
// Migrations of the database schema (ADR-backend-0001, ADR-backend-0002), run by `nuclear migrate` in the generated
// project once compiled:
//
//   synapsis-nest-migrate make "add done to tasks" --dir ../migrations   one migration: the entities minus the last one
//   synapsis-nest-migrate up [--to <name>] --dir ../migrations           applies the pending ones (up to <name>)
//   synapsis-nest-migrate down [--to <name>] --dir ../migrations         reverts the last one applied (or every one applied after <name>)
//   synapsis-nest-migrate status --dir ../migrations                     every migration: applied or pending
//
//   make takes --rename <table>=<new table> and --rename <table>.<column>=<new column> (the database's names; any number):
//   a rename that keeps the rows, where it would write a drop and an add
//   up and down take --fake (the history changes, nothing runs) and --transaction all|each|none (default: all)
//
// A migration is `<timestamp>_<slug>.js` with `up` and `down` over Sequelize's queryInterface, and `schema`: the tables
// once it is applied, which the next `make` compares the entities with (so `make` never reads the database, as in the
// fastapi dialect); `known` lists the migrations it was made after. A migration runs over `migrator`: Sequelize's
// queryInterface with what it gets wrong made right (a table of SQLite made and rebuilt without losing its key, its
// constraints or the rows that point to it; a column changed with its unique and its foreign key).
//
// The behaviour is TypeORM's (ADR-backend-0002), the same as the fastapi dialect's tool, with the same words: the table
// `migrations` holds one row per migration applied (`id`, `timestamp`, `name`); the migrations are ordered by their
// timestamp; a pending one runs whatever its place; `down` reverts the last one applied. A database migrated before
// 0.93 (its history in SequelizeMeta) is converted once.
import 'reflect-metadata';
import { existsSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataTypes, literal, type ModelAttributeColumnOptions, type QueryInterface } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { type AppConfig, databaseOf } from './config.js';

/** A column as a migration writes it: Sequelize's attribute, reduced to what reaches the database. */
export interface ColumnSchema {
  type: string;
  options?: Record<string, unknown>;
  allowNull: boolean;
  primaryKey?: true;
  autoIncrement?: true;
  unique?: true | string;
  /** a literal, `{ fn: 'NOW' }` for one of DataTypes' functions, or `{ literal: '(CURRENT_TIMESTAMP)' }` for SQL */
  defaultValue?: unknown;
  references?: { model: string; key: string };
  onDelete?: string;
  onUpdate?: string;
}

/** Every table of the app and its columns. */
export type Schema = Record<string, Record<string, ColumnSchema>>;

/** One change of the schema and the one that undoes it. */
export interface Change {
  up: string;
  down: string;
  /** what the user must know before applying it (data that is lost, a change a table with rows refuses) */
  warning?: string;
}

const typeName = (type: unknown): string => {
  // the class of the type, or the name it has in DataTypes when a database has its own class for it (JSON)
  const { constructor, key } = type as { constructor: { name: string }; key?: string };
  const name = constructor.name in DataTypes ? constructor.name : String(key);
  if (!(name in DataTypes)) throw new Error(`a column of type ${constructor.name} that migrations do not know`);
  return name;
};

// the database's clock as the default of a column, written the one way the four databases take for a column with a
// fraction (MySQL refuses CURRENT_TIMESTAMP without the parentheses there)
const CLOCK = '(CURRENT_TIMESTAMP)';

/** The schema of `models` (entity classes): their tables, with the join tables of their many-to-many relations. */
export function schemaOf(models: unknown[]): Schema {
  return schemaFrom(new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, models: models as never }));
}

/** The schema of the entities a database connection has: what a migration writes, whatever the database. */
export function schemaFrom(s: Sequelize): Schema {
  const schema: Schema = {};
  for (const model of Object.values(s.models)) {
    const table = String(model.getTableName());
    // @created / @updated: never empty, the database's clock by default (the app writes them too; ADR-backend-0002)
    const stamps = Object.values((model as unknown as { _timestampAttributes: Record<string, string> })._timestampAttributes ?? {});
    const columns: Record<string, ColumnSchema> = {};
    for (const [key, a] of Object.entries(model.getAttributes()) as [string, ModelAttributeColumnOptions][]) {
      const c: ColumnSchema = { type: typeName(a.type), allowNull: a.allowNull ?? !a.primaryKey };
      const options = JSON.parse(JSON.stringify((a.type as { options?: object }).options ?? {}));
      if (Object.keys(options).length) c.options = options;
      if (a.primaryKey) c.primaryKey = true;
      if (a.autoIncrement) c.autoIncrement = true;
      if (a.unique) c.unique = a.unique === true ? true : String(a.unique);
      if (a.defaultValue !== undefined) {
        c.defaultValue = a.defaultValue instanceof DataTypes.ABSTRACT ? { fn: typeName(a.defaultValue) } : a.defaultValue;
      }
      if (a.references && typeof a.references === 'object') {
        const r = a.references as { model: unknown; key?: string };
        c.references = { model: typeof r.model === 'string' ? r.model : String((r.model as { tableName?: string }).tableName ?? r.model), key: r.key ?? 'id' };
      }
      if (stamps.includes(key)) c.defaultValue = { literal: CLOCK };
      // a foreign key does nothing unless the relation says so: no rule is NO ACTION, and Nuclear has no word for
      // what a changed key does (Sequelize would write ON UPDATE CASCADE by itself)
      if (a.onDelete && a.onDelete.toUpperCase() !== 'NO ACTION') c.onDelete = a.onDelete.toUpperCase();
      columns[a.field ?? key] = c;
    }
    schema[table] = columns;
  }
  return schema;
}

// --- a text column: `@column(length = n)`. The one rule of its type (the same as the fastapi dialect's, synapsis.orm):
// the database's VARCHAR(n) while it holds n characters of any alphabet, then its text type that does.
/** The most characters a VARCHAR holds: MySQL and MariaDB keep 65535 bytes and a character takes up to four;
 * PostgreSQL's own limit; SQLite has none. */
export const VARCHAR_MAX: Record<string, number> = { mysql: 16383, mariadb: 16383, postgres: 10485760 };
/** The most characters a MEDIUMTEXT of MySQL and MariaDB holds (16777215 bytes); a longer text is a LONGTEXT. */
export const MEDIUMTEXT_MAX = 4194303;

/** The type a text column of `length` characters has on `dialect`, as the database names it. */
export function textType(dialect: string, length: number): string {
  if (length <= (VARCHAR_MAX[dialect] ?? Infinity)) return `VARCHAR(${length})`;
  return dialect === 'postgres' ? 'TEXT' : length <= MEDIUMTEXT_MAX ? 'MEDIUMTEXT' : 'LONGTEXT';
}

const js = (v: unknown): string => (v === undefined ? 'undefined' : JSON.stringify(v)).replace(/"([A-Za-z_$][\w$]*)":/g, '$1: ').replace(/,(?=[A-Za-z_$]+: )/g, ', ');

function column(c: ColumnSchema): string {
  const type = c.options ? `Sequelize.DataTypes.${c.type}(${js(c.options)})` : `Sequelize.DataTypes.${c.type}`;
  const parts = [`type: ${type}`, `allowNull: ${c.allowNull}`];
  if (c.primaryKey) parts.push('primaryKey: true');
  if (c.autoIncrement) parts.push('autoIncrement: true');
  if (c.unique) parts.push(`unique: ${js(c.unique)}`);
  if (c.defaultValue !== undefined) {
    const d = c.defaultValue as { fn?: string; literal?: string } | null;
    const written = d && typeof d === 'object' && d.fn ? `Sequelize.DataTypes.${d.fn}` : d && typeof d === 'object' && d.literal ? `Sequelize.literal(${js(d.literal)})` : js(c.defaultValue);
    parts.push(`defaultValue: ${written}`);
  }
  if (c.references) parts.push(`references: ${js(c.references)}`);
  if (c.onDelete) parts.push(`onDelete: ${js(c.onDelete)}`);
  if (c.onUpdate) parts.push(`onUpdate: ${js(c.onUpdate)}`);
  return `{ ${parts.join(', ')} }`;
}

const table = (name: string, columns: Record<string, ColumnSchema>): string =>
  `await queryInterface.createTable(${js(name)}, {\n${Object.entries(columns).map(([n, c]) => `  ${js(n)}: ${column(c)},`).join('\n')}\n});`;

/** A column of a schema as Sequelize's attribute: what its line of a migration file gives `createTable`. */
function attribute(c: ColumnSchema): ModelAttributeColumnOptions {
  const types = DataTypes as unknown as Record<string, ((options?: object) => ModelAttributeColumnOptions['type']) & ModelAttributeColumnOptions['type']>;
  const d = c.defaultValue as { fn?: string; literal?: string } | null | undefined;
  const { options: _o, ...rest } = c;
  return {
    ...rest,
    type: c.options ? types[c.type](c.options) : types[c.type],
    ...(d && typeof d === 'object' && d.fn ? { defaultValue: types[d.fn] } : d && typeof d === 'object' && d.literal ? { defaultValue: literal(d.literal) } : {}),
  } as ModelAttributeColumnOptions;
}

/** `createTables`: the tables of the entities the database does not have, made as the first migration makes them
 * (the same types, defaults, foreign keys and names of constraints): a database made this way is the one the
 * migrations make, and comes under them with `nuclear migrate --fake`. */
export async function createTables(sequelize: Sequelize): Promise<void> {
  const schema = schemaFrom(sequelize);
  const q = sequelize.getQueryInterface();
  for (const t of ordered(schema, Object.keys(schema))) {
    if (await q.tableExists(t)) continue;
    await migrator(q).createTable(t, Object.fromEntries(Object.entries(schema[t]).map(([n, c]) => [n, attribute(c)])));
  }
}

/** The tables of `schema` ordered so a table comes after the ones it references. */
function ordered(schema: Schema, names: string[]): string[] {
  const out: string[] = [];
  const visit = (n: string, path: Set<string>): void => {
    if (out.includes(n) || path.has(n) || !names.includes(n)) return;
    path.add(n);
    for (const c of Object.values(schema[n])) if (c.references) visit(c.references.model, path);
    out.push(n);
  };
  for (const n of [...names].sort()) visit(n, new Set());
  return out;
}

/** What turns `before` into `after`: new tables, new columns, changed columns, dropped columns, dropped tables. */
export function diff(before: Schema, after: Schema): Change[] {
  const changes: Change[] = [];
  const added = ordered(after, Object.keys(after).filter((t) => !(t in before)));
  for (const t of added) changes.push({ up: table(t, after[t]), down: `await queryInterface.dropTable(${js(t)});` });
  for (const t of Object.keys(after).filter((t) => t in before).sort()) {
    const [old, now] = [before[t], after[t]];
    // no migration of the platform changes a key: said, never skipped
    const key = (columns: Record<string, ColumnSchema>): string => Object.keys(columns).filter((c) => columns[c].primaryKey).sort().join(', ');
    if (key(old) !== key(now)) {
      throw new Error(`the key of ${t} changed (${key(old)} to ${key(now)}): a migration does not change a key; make the table under another name and move its rows`);
    }
    for (const c of Object.keys(now).filter((c) => !(c in old))) {
      const required = !now[c].allowNull && now[c].defaultValue === undefined && !now[c].autoIncrement;
      changes.push({
        up: `await queryInterface.addColumn(${js(t)}, ${js(c)}, ${column(now[c])});`,
        down: `await queryInterface.removeColumn(${js(t)}, ${js(c)});`,
        ...(required ? { warning: `the migration adds the required column ${t}.${c} without a default: a table with rows refuses it` } : {}),
      });
    }
    for (const c of Object.keys(now).filter((c) => c in old && js(old[c]) !== js(now[c]))) {
      changes.push({
        up: `await queryInterface.changeColumn(${js(t)}, ${js(c)}, ${column(now[c])});`,
        down: `await queryInterface.changeColumn(${js(t)}, ${js(c)}, ${column(old[c])});`,
        ...(old[c].allowNull && !now[c].allowNull ? { warning: `the migration makes ${t}.${c} required: it fails while a row has it empty` } : {}),
      });
    }
    for (const c of Object.keys(old).filter((c) => !(c in now))) {
      changes.push({
        up: `await queryInterface.removeColumn(${js(t)}, ${js(c)});`,
        down: `await queryInterface.addColumn(${js(t)}, ${js(c)}, ${column(old[c])});`,
        warning: `the migration drops column ${t}.${c}, with its values; if it was renamed, delete this migration and make it with --rename ${t}.${c}=<new column>`,
      });
    }
  }
  const dropped = ordered(before, Object.keys(before).filter((t) => !(t in after))).reverse();
  for (const t of dropped) {
    changes.push({ up: `await queryInterface.dropTable(${js(t)});`, down: table(t, before[t]), warning: `the migration drops table ${t}, with its rows; if it was renamed, delete this migration and make it with --rename ${t}=<new table>` });
  }
  return changes;
}

/** `--rename` of `make`: each `<table>=<new table>` or `<table>.<column>=<new column>` (the database's names, as the
 * migrations have them) as a change that keeps the rows, and `before` with those renames made, so `diff` writes only
 * what else changed. The tables first: a column is renamed in its table whatever name the table has now. A rename
 * whose old name the migrations do not have, or whose new name the entities do not have, is refused (the same words
 * as the fastapi dialect's tool). */
export function renamed(before: Schema, after: Schema, renames: string[]): { schema: Schema; changes: Change[] } {
  const schema: Schema = Object.fromEntries(Object.entries(before).map(([t, columns]) => [t, Object.fromEntries(Object.entries(columns).map(([c, v]) => [c, { ...v }]))]));
  const changes: Change[] = [];
  const parsed = renames.map((r) => {
    const m = /^(\w+)(?:\.(\w+))?=(\w+)$/.exec(r);
    if (!m) throw new Error(`--rename takes <table>=<new table> or <table>.<column>=<new column>, not ${r}`);
    return { table: m[1], column: m[2] as string | undefined, to: m[3] };
  });
  /** was: the migrations have the old name; still: the entities too; is: the entities have the new one; taken: the migrations too */
  const refuse = (old: string, to: string, kind: string, now: string, was: boolean, still: boolean, is: boolean, taken: boolean): void => {
    if (!was) throw new Error(`cannot rename ${old}: the migrations have no ${kind} ${old}`);
    if (still) throw new Error(`cannot rename ${old}: the entities still have the ${kind} ${old}`);
    if (!is) throw new Error(`cannot rename ${old} to ${to}: the entities have no ${kind} ${now}`);
    if (taken) throw new Error(`cannot rename ${old} to ${to}: the migrations already have the ${kind} ${now}`);
  };
  const references = (change: (r: { model: string; key: string }) => void): void => {
    for (const columns of Object.values(schema)) for (const c of Object.values(columns)) if (c.references) change((c.references = { ...c.references }));
  };
  const tables = new Map<string, string>();
  for (const { table: t, to } of parsed.filter((r) => !r.column)) {
    refuse(t, to, 'table', to, t in schema, t in after, to in after, to in schema);
    schema[to] = schema[t];
    delete schema[t];
    references((r) => { if (r.model === t) r.model = to; });
    tables.set(t, to);
    changes.push({ up: `await queryInterface.renameTable(${js(t)}, ${js(to)});`, down: `await queryInterface.renameTable(${js(to)}, ${js(t)});` });
  }
  for (const { table, column, to } of parsed.filter((r) => r.column)) {
    const t = tables.get(table) ?? table;
    const [had, have] = [schema[t] ?? {}, after[t] ?? {}];
    refuse(`${table}.${column}`, to, 'column', `${t}.${to}`, column! in had, column! in have, to in have, to in had);
    schema[t] = Object.fromEntries(Object.entries(had).map(([c, v]) => [c === column ? to : c, v]));
    references((r) => { if (r.model === t && r.key === column) r.key = to; });
    changes.push({ up: `await queryInterface.renameColumn(${js(t)}, ${js(column)}, ${js(to)});`, down: `await queryInterface.renameColumn(${js(t)}, ${js(to)}, ${js(column)});` });
  }
  return { schema, changes };
}

/** The text of a migration file; `known`: the migrations of the folder when it is made. */
export function render(message: string, changes: Change[], schema: Schema, known: string[] = []): string {
  const indent = (s: string): string => s.split('\n').map((l) => `  ${l}`).join('\n');
  return `// ${message.replace(/\s+/g, ' ')}
// Written by \`nuclear migrate make\` from the entities; it is the project's from now on (a renamed table or column
// is a drop and an add unless make is told: --rename <table>=<new table>, --rename <table>.<column>=<new column>).

/** @param {import('sequelize').QueryInterface} queryInterface @param {typeof import('sequelize')} Sequelize */
export async function up(queryInterface, Sequelize) {
${changes.map((c) => indent(c.up)).join('\n')}
}

/** @param {import('sequelize').QueryInterface} queryInterface @param {typeof import('sequelize')} Sequelize */
export async function down(queryInterface, Sequelize) {
${[...changes].reverse().map((c) => indent(c.down)).join('\n')}
}

// the migrations this one was made after: what its changes were compared with
export const known = ${JSON.stringify(known)};

// the tables once this migration is applied: what the next \`nuclear migrate make\` compares the entities with
export const schema = ${JSON.stringify(schema, null, 2)};
`;
}

/** A migration of the folder: its name is its file without `.js`. */
export interface Migration {
  name: string;
  file: string;
  up: (q: QueryInterface, s: typeof Sequelize) => Promise<void>;
  down: (q: QueryInterface, s: typeof Sequelize) => Promise<void>;
  schema?: Schema;
  /** the migrations of the folder when this one was made */
  known?: string[];
  /** before 0.93: the last migration when this one was made */
  parent?: string | null;
}

/** The migrations of `dir`, by their timestamp. */
export async function migrations(dir: string): Promise<Migration[]> {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{14}_.*\.js$/.test(f)).sort() : [];
  const all: Migration[] = [];
  for (const file of files) {
    // read again when the file changed (a migration edited between two commands of one process)
    const m = (await import(`${pathToFileURL(join(dir, file)).href}?${statSync(join(dir, file)).mtimeMs}`)) as Partial<Migration>;
    all.push({ name: file.slice(0, -3), file, up: m.up!, down: m.down!, schema: m.schema, known: m.known, parent: m.parent });
  }
  return all;
}

/** The tables once every migration of `all` is applied. Each one brings what it changed since the migrations it was
 * made after (`known`): two made at the same time, each without the other, both count, and so does one that runs
 * before the ones it was made after. A file of before 0.93 has `parent` (every migration up to that one) or neither
 * (the ones before it). */
export function schemaAfter(all: Migration[]): Schema {
  const memo = new Map<string, Schema>();
  const fold = (list: Migration[]): Schema => {
    const key = list.map((m) => m.name).join('|');
    const found = memo.get(key);
    if (found) return found;
    let state: Schema = {};
    list.forEach((m, i) => {
      if (!m.schema) return;
      const before = list.slice(0, i);
      const at = m.parent ? all.findIndex((x) => x.name === m.parent) : -1;
      const known = m.known ? all.filter((x) => x !== m && m.known!.includes(x.name)) : m.parent === null ? [] : at >= 0 ? all.slice(0, at + 1).filter((x) => x !== m) : before;
      const base = known.length === before.length && known.every((x, k) => x === before[k]) ? state : fold(known);
      const next: Schema = Object.fromEntries(Object.entries(state).map(([t, columns]) => [t, { ...columns }]));
      for (const t of new Set([...Object.keys(base), ...Object.keys(m.schema)])) {
        if (!(t in m.schema)) {
          delete next[t];
          continue;
        }
        next[t] ??= {};
        for (const c of new Set([...Object.keys(base[t] ?? {}), ...Object.keys(m.schema[t])])) {
          if (js(base[t]?.[c]) === js(m.schema[t][c])) continue;
          if (c in m.schema[t]) next[t][c] = m.schema[t][c];
          else delete next[t][c];
        }
      }
      state = next;
    });
    memo.set(key, state);
    return state;
  };
  return fold(all);
}

const slug = (message: string): string => message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'migration';

// local time, as the fastapi dialect names its migrations
const stamp = (d = new Date()): string =>
  [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');

/** Writes the migration from the migrations of the folder to `models`; null when nothing changed. `renames`: what
 * `--rename` names (`renamed`). */
export async function make(dir: string, message: string, models: unknown[], now = new Date(), renames: string[] = []): Promise<string | null> {
  const all = await migrations(dir);
  const after = schemaOf(models);
  const moved = renamed(schemaAfter(all), after, renames);
  const changes = [...moved.changes, ...diff(moved.schema, after)];
  if (!changes.length) return null;
  mkdirSync(dir, { recursive: true });
  const at = new Date(now);
  while (readdirSync(dir).some((f) => f.startsWith(`${stamp(at)}_`))) at.setSeconds(at.getSeconds() + 1); // two in one second: the next one
  const file = join(dir, `${stamp(at)}_${slug(message)}.js`);
  writeFileSync(file, render(message, changes, after, all.map((m) => m.name)), { flag: 'wx' });
  for (const c of changes) if (c.warning) console.warn(`warning: ${c.warning}`);
  return file;
}

type Attribute = ModelAttributeColumnOptions;
type Row = Record<string, unknown>;

/** Sequelize's queryInterface as a migration needs it, for every database:
 * - a unique or a foreign key gets a name (`uq_<table>_<column>`, `fk_<table>_<column>`), and is found by its column
 *   when it goes, whatever name it was made with;
 * - `changeColumn` leaves the column as the attribute says: type, null, default, unique and foreign key;
 * - SQLite cannot alter a column: its table is rebuilt from what the database says, keeping the key, the generated
 *   ids, the constraints and the rows of the tables that point to it (Sequelize's own rebuild loses them). */
export function migrator(q: QueryInterface): QueryInterface {
  const s = q.sequelize;
  const dialect = s.getDialect();
  const id = (n: string): string => q.quoteIdentifier(n);
  const rows = <T = Row>(sql: string): Promise<T[]> => s.query(sql, { type: 'SELECT' }) as unknown as Promise<T[]>;
  const core = (a: Attribute): Attribute => {
    const { unique: _u, references: _r, onDelete: _d, onUpdate: _p, primaryKey: _k, ...rest } = a;
    // a text longer than the database's VARCHAR holds is its text type (textType)
    const { key, options } = rest.type as { key?: string; options?: { length?: number } };
    const length = key === 'STRING' ? (options?.length ?? 255) : 0;
    if (length <= (VARCHAR_MAX[dialect] ?? Infinity)) return rest;
    return { ...rest, type: dialect === 'postgres' ? DataTypes.TEXT : DataTypes.TEXT(length <= MEDIUMTEXT_MAX ? 'medium' : 'long') };
  };
  const target = (a: Attribute): { table: string; key: string } => {
    const r = a.references as { model: string; key?: string };
    return { table: r.model, key: r.key ?? 'id' };
  };

  // --- PostgreSQL, MySQL, MariaDB: the constraints of one column, by the database's own catalog
  const schemaOfDatabase = dialect === 'postgres' ? 'current_schema()' : 'DATABASE()';
  const constraints = (t: string, c: string): Promise<{ name: string; type: string }[]> =>
    rows(`SELECT tc.constraint_name AS name, tc.constraint_type AS type FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage k ON k.constraint_name = tc.constraint_name AND k.table_schema = tc.table_schema AND k.table_name = tc.table_name
      WHERE tc.table_schema = ${schemaOfDatabase} AND tc.table_name = ${s.escape(t)} AND k.column_name = ${s.escape(c)}
      AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE')
      AND (SELECT COUNT(*) FROM information_schema.key_column_usage o WHERE o.constraint_name = tc.constraint_name AND o.table_schema = tc.table_schema AND o.table_name = tc.table_name) = 1`);
  const drop = (t: string, k: { name: string; type: string }): Promise<unknown> => {
    const how = dialect === 'postgres' ? 'CONSTRAINT' : k.type === 'UNIQUE' ? 'INDEX' : 'FOREIGN KEY';
    return s.query(`ALTER TABLE ${id(t)} DROP ${how} ${id(k.name)}`);
  };
  const unique = (t: string, c: string): Promise<void> => q.addConstraint(t, { type: 'unique', name: `uq_${t}_${c}`, fields: [c] });
  const foreign = (t: string, c: string, a: Attribute): Promise<void> => {
    const { table, key } = target(a);
    return q.addConstraint(t, { type: 'foreign key', name: `fk_${t}_${c}`, fields: [c], references: { table, field: key }, ...(a.onDelete ? { onDelete: a.onDelete } : {}), ...(a.onUpdate ? { onUpdate: a.onUpdate } : {}) } as never);
  };

  // --- SQLite: a table as the database has it, and the same table made again with a change
  interface Lite {
    columns: { name: string; sql: string }[];
    key: string[];
    generated: boolean;
    uniques: string[][];
    foreign: { columns: string[]; table: string; keys: (string | null)[]; onDelete: string; onUpdate: string }[];
    indexes: { columns: string[]; sql: string }[];
  }
  const read = async (t: string): Promise<Lite> => {
    const lit = s.escape(t);
    const info = await rows<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(`SELECT * FROM pragma_table_info(${lit})`);
    if (!info.length) throw new Error(`the database has no table ${t}`);
    const [{ sql }] = await rows<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ${lit}`);
    const lite: Lite = {
      columns: info.map((c) => ({ name: c.name, sql: `${c.type}${c.notnull ? ' NOT NULL' : ''}${c.dflt_value === null ? '' : ` DEFAULT (${c.dflt_value})`}` })),
      key: info.filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name),
      generated: /\bAUTOINCREMENT\b/i.test(sql),
      uniques: [],
      foreign: [],
      indexes: [],
    };
    for (const i of await rows<{ name: string; unique: number; origin: string }>(`SELECT * FROM pragma_index_list(${lit})`)) {
      const columns = (await rows<{ name: string }>(`SELECT name FROM pragma_index_info(${s.escape(i.name)}) ORDER BY seqno`)).map((c) => c.name);
      if (i.origin === 'u') lite.uniques.push(columns);
      else if (i.origin === 'c') lite.indexes.push({ columns, sql: (await rows<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ${s.escape(i.name)}`))[0].sql });
    }
    const keys = await rows<{ id: number; seq: number; table: string; from: string; to: string | null; on_update: string; on_delete: string }>(
      `SELECT * FROM pragma_foreign_key_list(${lit}) ORDER BY id, seq`,
    );
    for (const k of keys) {
      if (k.seq === 0) lite.foreign.push({ columns: [], table: k.table, keys: [], onDelete: k.on_delete, onUpdate: k.on_update });
      lite.foreign.at(-1)!.columns.push(k.from);
      lite.foreign.at(-1)!.keys.push(k.to);
    }
    return lite;
  };
  const list = (names: (string | null)[]): string => names.map((n) => id(n!)).join(', ');
  /** CREATE TABLE `name` with what `lite` says; its constraints are named after the table `t`. */
  const create = (name: string, t: string, lite: Lite): Promise<unknown> => {
    const single = lite.key.length === 1;
    const rule = (word: string, r?: string): string => (r && r.toUpperCase() !== 'NO ACTION' ? ` ON ${word} ${r.toUpperCase()}` : '');
    const parts = [
      ...lite.columns.map((c) => `${id(c.name)} ${c.sql}${single && lite.key[0] === c.name ? ` PRIMARY KEY${lite.generated ? ' AUTOINCREMENT' : ''}` : ''}`),
      ...(single || !lite.key.length ? [] : [`PRIMARY KEY (${list(lite.key)})`]),
      ...lite.uniques.map((u) => `CONSTRAINT ${id(`uq_${t}_${u.join('_')}`)} UNIQUE (${list(u)})`),
      ...lite.foreign.map((f) => `CONSTRAINT ${id(`fk_${t}_${f.columns.join('_')}`)} FOREIGN KEY (${list(f.columns)}) REFERENCES ${id(f.table)}${f.keys[0] === null ? '' : ` (${list(f.keys)})`}${rule('DELETE', f.onDelete)}${rule('UPDATE', f.onUpdate)}`),
    ];
    return s.query(`CREATE TABLE ${id(name)} (${parts.join(', ')})`);
  };
  const rebuild = async (t: string, change: (lite: Lite) => void): Promise<void> => {
    const lite = await read(t);
    const had = lite.columns.map((c) => c.name);
    change(lite);
    const next = `_nuclear_new_${t}`;
    const kept = list(lite.columns.map((c) => c.name).filter((c) => had.includes(c)));
    await create(next, t, lite);
    await s.query(`INSERT INTO ${id(next)} (${kept}) SELECT ${kept} FROM ${id(t)}`);
    await s.query(`DROP TABLE ${id(t)}`);
    await s.query(`ALTER TABLE ${id(next)} RENAME TO ${id(t)}`);
    for (const i of lite.indexes) await s.query(i.sql);
  };
  /** On SQLite: the column `c` of the table with the unique and the foreign key the attribute says. */
  const constrain = (lite: Lite, c: string, a: Attribute): void => {
    const only = (columns: string[]): boolean => columns.length === 1 && columns[0] === c;
    lite.uniques = lite.uniques.filter((u) => !only(u));
    lite.foreign = lite.foreign.filter((f) => !only(f.columns));
    if (a.unique) lite.uniques.push([c]);
    if (a.references) lite.foreign.push({ columns: [c], table: target(a).table, keys: [target(a).key], onDelete: a.onDelete ?? '', onUpdate: a.onUpdate ?? '' });
  };
  const sqlOf = (c: string, a: Attribute): string => {
    const { autoIncrement: _a, ...rest } = core(a);
    const sql = (q.queryGenerator as unknown as { attributesToSQL(a: Record<string, Attribute>): Record<string, string> }).attributesToSQL({ [c]: (s as unknown as { normalizeAttribute(a: Attribute): Attribute }).normalizeAttribute(rest) })[c];
    // SQLite keeps the name a type is written with: the names the other dialects write (ADR-backend-0002), and the
    // fraction of a DateTime as MySQL and MariaDB name it (Sequelize writes none for SQLite)
    const { key, options } = rest.type as { key?: string; options?: { length?: number } };
    const fraction = key === 'DATE' && options?.length;
    return sql.replace(/^TINYINT\(1\)/, 'BOOLEAN').replace(/^DOUBLE PRECISION/, 'DOUBLE').replace(/^DATETIME(?!\()/, fraction ? `DATETIME(${fraction})` : 'DATETIME');
  };

  const lite = dialect === 'sqlite';
  const own = {
    async createTable(t: string, attributes: Record<string, Attribute>, options?: object): Promise<void> {
      // Sequelize writes CREATE TABLE IF NOT EXISTS: a table that is already there would pass as made by this migration
      if (await q.tableExists(t)) throw new Error(`table ${t} already exists`);
      if (lite) {
        // written here: the types by their names, the key, the generated ids and every constraint with its name
        const made: Lite = { columns: [], key: [], generated: false, uniques: [], foreign: [], indexes: [] };
        for (const [c, a] of Object.entries(attributes)) {
          made.columns.push({ name: c, sql: sqlOf(c, a) });
          if (a.primaryKey) made.key.push(c);
          if (a.autoIncrement) made.generated = true;
          constrain(made, c, a);
        }
        await create(t, t, made);
        return;
      }
      // the table, then its uniques and foreign keys by name (inside CREATE TABLE the database names them)
      const plain = Object.fromEntries(Object.entries(attributes).map(([c, a]) => [c, { ...core(a), ...(a.primaryKey ? { primaryKey: true } : {}) }]));
      await q.createTable(t, plain, options as never);
      for (const [c, a] of Object.entries(attributes)) {
        if (a.unique) await unique(t, c);
        if (a.references) await foreign(t, c, a);
      }
    },
    async addColumn(t: string, c: string, a: Attribute): Promise<void> {
      if (lite) {
        await s.query(`ALTER TABLE ${id(t)} ADD COLUMN ${id(c)} ${sqlOf(c, a)}`);
        if (a.unique || a.references) await rebuild(t, (l) => constrain(l, c, a));
        return;
      }
      await q.addColumn(t, c, core(a));
      if (a.unique) await unique(t, c);
      if (a.references) await foreign(t, c, a);
    },
    async changeColumn(t: string, c: string, a: Attribute): Promise<void> {
      if (lite) {
        return rebuild(t, (l) => {
          const column = l.columns.find((x) => x.name === c);
          if (!column) throw new Error(`the table ${t} has no column ${c}`);
          column.sql = sqlOf(c, a);
          constrain(l, c, a);
        });
      }
      // the foreign key goes before the column changes and comes back after it; the unique only when it changes
      const have = await constraints(t, c);
      for (const k of have) if (k.type === 'FOREIGN KEY' || !a.unique) await drop(t, k);
      await q.changeColumn(t, c, core(a));
      if (a.unique && !have.some((k) => k.type === 'UNIQUE')) await unique(t, c);
      if (a.references) await foreign(t, c, a);
    },
    async removeColumn(t: string, c: string): Promise<void> {
      if (!lite) {
        for (const k of await constraints(t, c)) await drop(t, k);
        await s.query(`ALTER TABLE ${id(t)} DROP COLUMN ${id(c)}`);
        return;
      }
      await rebuild(t, (l) => {
        const without = (columns: string[]): boolean => !columns.includes(c);
        if (!l.columns.some((x) => x.name === c)) throw new Error(`the table ${t} has no column ${c}`);
        l.columns = l.columns.filter((x) => x.name !== c);
        l.uniques = l.uniques.filter(without);
        l.foreign = l.foreign.filter((f) => without(f.columns));
        l.indexes = l.indexes.filter((i) => without(i.columns));
      });
    },
    // every database of the platform renames a column in place, keeping its data, constraints and what points to it
    async renameColumn(t: string, from: string, to: string): Promise<void> {
      await s.query(`ALTER TABLE ${id(t)} RENAME COLUMN ${id(from)} TO ${id(to)}`);
    },
  };
  return Object.assign(Object.create(q) as QueryInterface, own);
}

const HISTORY = 'migrations';
export type Transaction = 'all' | 'each' | 'none';

/** The names of the applied migrations in the order they were applied. The table is made when it is missing, from
 * SequelizeMeta when the database was migrated before 0.93. */
async function history(sequelize: Sequelize): Promise<string[]> {
  const q = sequelize.getQueryInterface();
  const names = async (table: string, order: string): Promise<string[]> =>
    ((await sequelize.query(`SELECT name FROM ${q.quoteIdentifier(table)} ORDER BY ${order}`, { type: 'SELECT' })) as { name: string }[]).map((r) => r.name.replace(/\.js$/, ''));
  if (!(await q.tableExists(HISTORY))) {
    const before = (await q.tableExists('SequelizeMeta')) ? await names('SequelizeMeta', 'name') : [];
    await q.createTable(HISTORY, {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      timestamp: { type: DataTypes.BIGINT, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
    });
    if (before.length) await q.bulkInsert(HISTORY, before.map((name) => ({ timestamp: Number(name.slice(0, 14)), name })));
  }
  return names(HISTORY, 'id');
}

/** Every migration of `dir`, by its timestamp, and whether the database has it. */
export async function status(dir: string, sequelize: Sequelize): Promise<{ name: string; applied: boolean }[]> {
  const applied = new Set(await history(sequelize));
  return (await migrations(dir)).map((m) => ({ name: m.name, applied: applied.has(m.name) }));
}

/** The migration `to` names: its name, or the timestamp it starts with. */
function find(all: Migration[], to: string, dir: string): number {
  const name = basename(to).replace(/\.js$/, '');
  const i = all.findIndex((m) => m.name === name || m.name.startsWith(`${name}_`));
  if (i < 0) throw new Error(`no migration ${to} in ${dir}`);
  return i;
}

/** Applies or reverts `steps` and writes the history with each one. `all`: one transaction for the whole run; `each`:
 * one per migration; `none`: no transaction. PostgreSQL and SQLite undo what a failed transaction did; MySQL and
 * MariaDB commit every schema change as it runs. */
async function execute(
  sequelize: Sequelize, steps: Migration[], direction: 'up' | 'down', fake: boolean, transaction: Transaction, each: (name: string) => void,
): Promise<string[]> {
  const q = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();
  const lite = dialect === 'sqlite';
  const mysql = dialect === 'mysql' || dialect === 'mariadb';
  const begin = (): Promise<unknown> => sequelize.query(lite ? 'BEGIN' : 'START TRANSACTION');
  const done: string[] = [];
  let name = '';
  // SQLite: a rebuilt table must not delete the rows that point to it (the setting cannot change inside a transaction)
  if (lite) await sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    if (transaction === 'all') await begin();
    for (const m of steps) {
      name = m.name;
      if (transaction === 'each') await begin();
      if (!fake) {
        await m[direction](migrator(q), Sequelize);
        if (lite) {
          const broken = (await sequelize.query('PRAGMA foreign_key_check', { type: 'SELECT' })) as { table: string; parent: string }[];
          if (broken.length) throw new Error(`rows of ${broken[0].table} point to rows of ${broken[0].parent} that do not exist`);
        }
      }
      if (direction === 'up') await q.bulkInsert(HISTORY, [{ timestamp: Number(name.slice(0, 14)), name }]);
      else await q.bulkDelete(HISTORY, { name });
      if (transaction === 'each') await sequelize.query('COMMIT');
      done.push(name);
    }
    if (transaction === 'all') await sequelize.query('COMMIT');
  } catch (e) {
    if (transaction !== 'none') await sequelize.query('ROLLBACK').catch(() => undefined);
    // what stays applied of this run: nothing where one transaction held it all
    for (const kept of transaction === 'all' && !mysql ? [] : done) each(kept);
    const reason = (e instanceof Error ? e.message : String(e)).split('\n')[0];
    const left = mysql
      ? 'this database does not undo schema changes: what it did before failing is still there, undo it by hand before running it again'
      : transaction === 'none'
        ? 'it ran without a transaction: what it did before failing is still there, undo it by hand before running it again'
        : transaction === 'all'
          ? 'nothing of this run was kept'
          : 'nothing of it was kept';
    throw new Error(`the migration ${name} failed${direction === 'down' ? ' to revert' : ''}: ${reason}\n${left}`);
  } finally {
    if (lite) await sequelize.query('PRAGMA foreign_keys = ON');
  }
  for (const n of done) each(n);
  return done;
}

export interface RunOptions {
  /** the migration to stop at: its name or its timestamp */
  to?: string;
  /** hears every migration that stays applied (or reverted) */
  each?: (name: string) => void;
  /** the history changes and nothing runs */
  fake?: boolean;
  transaction?: Transaction;
}

/** Applies the pending migrations, by their timestamp (up to `to`, when given); returns their names. */
export async function up(dir: string, sequelize: Sequelize, options: RunOptions = {}): Promise<string[]> {
  const applied = new Set(await history(sequelize));
  const all = await migrations(dir);
  const last = options.to === undefined ? all.length - 1 : find(all, options.to, dir);
  const steps = all.slice(0, last + 1).filter((m) => !applied.has(m.name));
  return execute(sequelize, steps, 'up', !!options.fake, options.transaction ?? 'all', options.each ?? (() => undefined));
}

/** Reverts the last migration applied, or every one applied after `to`; returns their names, the last one first. */
export async function down(dir: string, sequelize: Sequelize, options: RunOptions = {}): Promise<string[]> {
  const applied = await history(sequelize);
  const all = await migrations(dir);
  let back = applied.slice(-1);
  if (options.to !== undefined) {
    const name = all[find(all, options.to, dir)].name;
    if (!applied.includes(name)) throw new Error(`the migration ${name} is not applied`);
    back = applied.slice(applied.indexOf(name) + 1);
  }
  const steps = back.reverse().map((name) => {
    const m = all.find((x) => x.name === name);
    if (!m) throw new Error(`the migration ${name} is applied and is not in ${dir}: it cannot be reverted without its file`);
    return m;
  });
  return execute(sequelize, steps, 'down', !!options.fake, options.transaction ?? 'all', options.each ?? (() => undefined));
}

/** The database of the app's configuration, without the Nest app: one connection, so a migration's transaction holds
 * everything it runs. */
export function databaseOfApp(config: AppConfig, models: unknown[]): Sequelize {
  const { uri, autoLoadModels: _a, synchronize: _s, ...options } = databaseOf(config) as Record<string, unknown> & { uri?: string };
  const all = { ...options, logging: false, models: models as never, pool: { max: 1, min: 1 } };
  return uri ? new Sequelize(uri, all) : new Sequelize(all);
}

const USAGE = 'usage: synapsis-nest-migrate make "<message>" [--rename <table>[.<column>]=<new name>]... | up | down [--to <name>] [--fake] [--transaction all|each|none] | status [--dir <folder>]';

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const flag = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (!['make', 'up', 'down', 'status'].includes(command)) throw new Error(USAGE);
  const dir = resolve(flag('--dir') ?? '../migrations');
  // the compiled app module lists the entities and the configuration (the dialect's app_module template)
  const app = (await import(pathToFileURL(resolve(flag('--app') ?? 'dist/src/app.module.js')).href)) as { entities: unknown[]; config: AppConfig };
  if (command === 'make') {
    const message = rest.find((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
    if (!message) throw new Error('usage: make "<what changes>"');
    const file = await make(dir, message, app.entities, new Date(), rest.filter((_, i) => rest[i - 1] === '--rename'));
    console.log(file ? `wrote ${file}` : 'no changes: the entities match the last migration');
    return;
  }
  const db = databaseOfApp(app.config, app.entities);
  try {
    const transaction = (flag('--transaction') ?? 'all') as Transaction;
    if (!['all', 'each', 'none'].includes(transaction)) throw new Error(USAGE);
    const fake = rest.includes('--fake');
    const said = (word: string) => (name: string) => console.log(`${word} ${name}${fake ? ' (fake)' : ''}`);
    if (command === 'status') {
      const all = await status(dir, db);
      console.log(all.length ? all.map((m) => `${m.applied ? 'applied' : 'pending'}  ${m.name}`).join('\n') : `no migrations in ${dir}`);
    } else if (command === 'up') {
      const done = await up(dir, db, { to: flag('--to'), each: said('applied'), fake, transaction });
      if (!done.length) console.log('the database is up to date');
    } else {
      const done = await down(dir, db, { to: flag('--to'), each: said('reverted'), fake, transaction });
      if (!done.length) console.log(flag('--to') ? 'nothing to revert' : 'no migration is applied');
    }
  } finally {
    await db.close();
  }
}

// run as a program (npx runs it through node_modules/.bin, a link)
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}
