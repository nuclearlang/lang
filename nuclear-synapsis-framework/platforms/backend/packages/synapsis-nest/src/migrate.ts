#!/usr/bin/env node
// Migrations of the database schema (ADR-backend-0001), run by `nuclear migrate` in the generated project once compiled:
//
//   synapsis-nest-migrate make "add done to tasks" --dir ../migrations   one migration: the entities minus the last one
//   synapsis-nest-migrate up [--to <name>] --dir ../migrations           applies the pending ones (up to <name>)
//   synapsis-nest-migrate down [--to <name>] --dir ../migrations         reverts the last one (or every one after <name>)
//   synapsis-nest-migrate status --dir ../migrations                     every migration: applied or pending
//
// A migration is `<timestamp>_<slug>.js` with `up` and `down` over Sequelize's queryInterface, `parent` (the migration
// it was made after: the history is one line) and `schema`: the tables once it is applied, which the next `make`
// compares the entities with (so `make` never reads the database, as in the fastapi dialect). Applied migrations are
// listed in the table SequelizeMeta, as sequelize-cli and umzug do. Each one runs in a transaction of its own, over
// `migrator`: Sequelize's queryInterface with what it gets wrong made right (a table of SQLite rebuilt without
// losing its key, its constraints or the rows that point to it; a column changed with its unique and its foreign key).
import 'reflect-metadata';
import { existsSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DataTypes, type ModelAttributeColumnOptions, type QueryInterface } from 'sequelize';
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
  /** a literal, or `{ fn: 'NOW' }` for one of DataTypes' functions */
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
  const name = (type as { constructor: { name: string } }).constructor.name;
  if (!(name in DataTypes)) throw new Error(`a column of type ${name} that migrations do not know`);
  return name;
};

/** The schema of `models` (entity classes): their tables, with the join tables of their many-to-many relations. */
export function schemaOf(models: unknown[]): Schema {
  const s = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, models: models as never });
  const schema: Schema = {};
  for (const model of Object.values(s.models)) {
    const table = String(model.getTableName());
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
      if (a.onDelete) c.onDelete = a.onDelete.toUpperCase();
      if (a.onUpdate) c.onUpdate = a.onUpdate.toUpperCase();
      columns[a.field ?? key] = c;
    }
    schema[table] = columns;
  }
  return schema;
}

const js = (v: unknown): string => JSON.stringify(v).replace(/"([A-Za-z_$][\w$]*)":/g, '$1: ').replace(/,(?=[A-Za-z_$]+: )/g, ', ');

function column(c: ColumnSchema): string {
  const type = c.options ? `Sequelize.DataTypes.${c.type}(${js(c.options)})` : `Sequelize.DataTypes.${c.type}`;
  const parts = [`type: ${type}`, `allowNull: ${c.allowNull}`];
  if (c.primaryKey) parts.push('primaryKey: true');
  if (c.autoIncrement) parts.push('autoIncrement: true');
  if (c.unique) parts.push(`unique: ${js(c.unique)}`);
  if (c.defaultValue !== undefined) {
    const d = c.defaultValue as { fn?: string };
    parts.push(`defaultValue: ${d && typeof d === 'object' && d.fn ? `Sequelize.DataTypes.${d.fn}` : js(c.defaultValue)}`);
  }
  if (c.references) parts.push(`references: ${js(c.references)}`);
  if (c.onDelete) parts.push(`onDelete: ${js(c.onDelete)}`);
  if (c.onUpdate) parts.push(`onUpdate: ${js(c.onUpdate)}`);
  return `{ ${parts.join(', ')} }`;
}

const table = (name: string, columns: Record<string, ColumnSchema>): string =>
  `await queryInterface.createTable(${js(name)}, {\n${Object.entries(columns).map(([n, c]) => `  ${js(n)}: ${column(c)},`).join('\n')}\n});`;

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
        warning: `the migration drops column ${t}.${c}; if it was renamed, edit it`,
      });
    }
  }
  const dropped = ordered(before, Object.keys(before).filter((t) => !(t in after))).reverse();
  for (const t of dropped) {
    changes.push({ up: `await queryInterface.dropTable(${js(t)});`, down: table(t, before[t]), warning: `the migration drops table ${t}; if it was renamed, edit it` });
  }
  return changes;
}

/** The text of a migration file made after the migration `parent` (null: the first one). */
export function render(message: string, changes: Change[], schema: Schema, parent: string | null = null): string {
  const indent = (s: string): string => s.split('\n').map((l) => `  ${l}`).join('\n');
  return `// ${message.replace(/\s+/g, ' ')}
// Written by \`nuclear migrate make\` from the entities; it is the project's from now on (a renamed table or column
// shows as a drop and an add: change it to queryInterface.renameColumn / renameTable to keep the data).

/** @param {import('sequelize').QueryInterface} queryInterface @param {typeof import('sequelize')} Sequelize */
export async function up(queryInterface, Sequelize) {
${changes.map((c) => indent(c.up)).join('\n')}
}

/** @param {import('sequelize').QueryInterface} queryInterface @param {typeof import('sequelize')} Sequelize */
export async function down(queryInterface, Sequelize) {
${[...changes].reverse().map((c) => indent(c.down)).join('\n')}
}

// the migration this one was made after (the history is one line)
export const parent = ${JSON.stringify(parent)};

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
  parent: string | null;
}

/** The migrations of `dir` from the first to the last. The history is one line: two migrations made after the same
 * one (two people at once) are refused, and so is one whose parent is not in the folder. */
export async function chain(dir: string): Promise<Migration[]> {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{14}_.*\.js$/.test(f)).sort() : [];
  const all: Migration[] = [];
  for (const file of files) {
    // read again when the file changed (a migration edited between two commands of one process)
    const m = (await import(`${pathToFileURL(join(dir, file)).href}?${statSync(join(dir, file)).mtimeMs}`)) as Partial<Migration>;
    // a migration written before `parent` existed follows the file before it
    const parent = m.parent !== undefined ? m.parent : (all.at(-1)?.name ?? null);
    all.push({ name: file.slice(0, -3), file, up: m.up!, down: m.down!, schema: m.schema, parent });
  }
  const names = new Set(all.map((m) => m.name));
  const out: Migration[] = [];
  let at: string | null = null;
  for (;;) {
    const next = all.filter((m) => m.parent === at);
    if (next.length > 1) {
      throw new Error(`the migrations ${next[0].name} and ${next[1].name} both follow ${at ?? 'no migration'}: they were made at the same time; delete one, apply the other and make it again`);
    }
    if (!next.length) break;
    out.push(next[0]);
    at = next[0].name;
  }
  const lost = all.find((m) => m.parent !== null && !names.has(m.parent));
  if (lost) throw new Error(`the migration ${lost.name} follows ${lost.parent}, which is not in ${dir}`);
  return out;
}

const slug = (message: string): string => message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'migration';

// local time, as the fastapi dialect names its migrations
const stamp = (d = new Date()): string =>
  [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');

/** Writes the migration from the last one to `models`; null when nothing changed. */
export async function make(dir: string, message: string, models: unknown[], now = new Date()): Promise<string | null> {
  const last = (await chain(dir)).at(-1);
  const after = schemaOf(models);
  const changes = diff(last?.schema ?? {}, after);
  if (!changes.length) return null;
  mkdirSync(dir, { recursive: true });
  const at = new Date(now);
  while (readdirSync(dir).some((f) => f.startsWith(`${stamp(at)}_`))) at.setSeconds(at.getSeconds() + 1); // two in one second: the next one
  const file = join(dir, `${stamp(at)}_${slug(message)}.js`);
  writeFileSync(file, render(message, changes, after, last?.name ?? null), { flag: 'wx' });
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
    return rest;
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
  const rebuild = async (t: string, change: (lite: Lite) => void): Promise<void> => {
    const lite = await read(t);
    const had = lite.columns.map((c) => c.name);
    change(lite);
    const single = lite.key.length === 1;
    const list = (names: (string | null)[]): string => names.map((n) => id(n!)).join(', ');
    const rule = (word: string, r?: string): string => (r && r.toUpperCase() !== 'NO ACTION' ? ` ON ${word} ${r.toUpperCase()}` : '');
    const parts = [
      ...lite.columns.map((c) => `${id(c.name)} ${c.sql}${single && lite.key[0] === c.name ? ` PRIMARY KEY${lite.generated ? ' AUTOINCREMENT' : ''}` : ''}`),
      ...(single || !lite.key.length ? [] : [`PRIMARY KEY (${list(lite.key)})`]),
      ...lite.uniques.map((u) => `CONSTRAINT ${id(`uq_${t}_${u.join('_')}`)} UNIQUE (${list(u)})`),
      ...lite.foreign.map((f) => `CONSTRAINT ${id(`fk_${t}_${f.columns.join('_')}`)} FOREIGN KEY (${list(f.columns)}) REFERENCES ${id(f.table)}${f.keys[0] === null ? '' : ` (${list(f.keys)})`}${rule('DELETE', f.onDelete)}${rule('UPDATE', f.onUpdate)}`),
    ];
    const next = `_nuclear_new_${t}`;
    const kept = list(lite.columns.map((c) => c.name).filter((c) => had.includes(c)));
    await s.query(`CREATE TABLE ${id(next)} (${parts.join(', ')})`);
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
    return (q.queryGenerator as unknown as { attributesToSQL(a: Record<string, Attribute>): Record<string, string> }).attributesToSQL({ [c]: (s as unknown as { normalizeAttribute(a: Attribute): Attribute }).normalizeAttribute(rest) })[c];
  };

  const lite = dialect === 'sqlite';
  const own = {
    async createTable(t: string, attributes: Record<string, Attribute>, options?: object): Promise<void> {
      // Sequelize writes CREATE TABLE IF NOT EXISTS: a table that is already there would pass as made by this migration
      if (await q.tableExists(t)) throw new Error(`table ${t} already exists`);
      if (lite) return q.createTable(t, attributes, options as never);
      // the table, then its uniques and foreign keys by name (inside CREATE TABLE the database names them)
      const plain = Object.fromEntries(Object.entries(attributes).map(([c, a]) => [c, { ...core(a), ...(a.primaryKey ? { primaryKey: true } : {}) }]));
      await q.createTable(t, plain, options as never);
      for (const [c, a] of Object.entries(attributes)) {
        if (a.unique) await unique(t, c);
        if (a.references) await foreign(t, c, a);
      }
    },
    async addColumn(t: string, c: string, a: Attribute): Promise<void> {
      await q.addColumn(t, c, core(a));
      if (lite) {
        if (a.unique || a.references) await rebuild(t, (l) => constrain(l, c, a));
        return;
      }
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

const META = 'SequelizeMeta';
const transactional = (s: Sequelize): boolean => !['mysql', 'mariadb'].includes(s.getDialect());

/** The names of the applied migrations, as the database lists them. */
async function applied(q: QueryInterface): Promise<string[]> {
  if (!(await q.tableExists(META))) return [];
  const rows = (await q.sequelize.query(`SELECT name FROM ${q.quoteIdentifier(META)}`, { type: 'SELECT' })) as { name: string }[];
  return rows.map((r) => r.name.replace(/\.js$/, ''));
}

/** Every migration of `dir` and whether the database has it. The applied ones are the first of the line: one applied
 * that is not in the folder, or one pending before an applied one, is refused. */
export async function status(dir: string, sequelize: Sequelize): Promise<{ name: string; applied: boolean; migration: Migration }[]> {
  const all = await chain(dir);
  const done = new Set(await applied(sequelize.getQueryInterface()));
  const lost = [...done].find((n) => !all.some((m) => m.name === n));
  if (lost) throw new Error(`the database has the migration ${lost} applied, which is not in ${dir}`);
  const out = all.map((migration) => ({ name: migration.name, applied: done.has(migration.name), migration }));
  const gap = out.findIndex((m) => !m.applied);
  const after = out.find((m, i) => gap >= 0 && i > gap && m.applied);
  if (after) throw new Error(`the migration ${out[gap].name} is not applied and ${after.name}, made after it, is`);
  return out;
}

/** The migration `to` names: its name, or the timestamp it starts with. */
function find<T extends { name: string }>(all: T[], to: string, dir: string): number {
  const name = basename(to).replace(/\.js$/, '');
  const i = all.findIndex((m) => m.name === name || m.name.startsWith(`${name}_`));
  if (i < 0) throw new Error(`no migration ${to} in ${dir}`);
  return i;
}

/** One migration, up or down, in a transaction of its own with its line of SequelizeMeta: all of it or nothing where
 * the database undoes schema changes (PostgreSQL, SQLite; MySQL and MariaDB commit each one as it runs). */
async function run(sequelize: Sequelize, m: Migration, direction: 'up' | 'down'): Promise<void> {
  const q = sequelize.getQueryInterface();
  const lite = sequelize.getDialect() === 'sqlite';
  await q.createTable(META, { name: { type: DataTypes.STRING, allowNull: false, primaryKey: true } });
  // SQLite: a rebuilt table must not delete the rows that point to it (the setting cannot change inside a transaction)
  if (lite) await sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    await sequelize.query(lite ? 'BEGIN' : 'START TRANSACTION');
    try {
      await m[direction](migrator(q), Sequelize);
      if (lite) {
        const broken = (await sequelize.query('PRAGMA foreign_key_check', { type: 'SELECT' })) as { table: string; parent: string }[];
        if (broken.length) throw new Error(`rows of ${broken[0].table} point to rows of ${broken[0].parent} that do not exist`);
      }
      if (direction === 'up') await q.bulkInsert(META, [{ name: m.file }]);
      else await q.bulkDelete(META, { name: m.file });
      await sequelize.query('COMMIT');
    } catch (e) {
      await sequelize.query('ROLLBACK').catch(() => undefined);
      const reason = (e instanceof Error ? e.message : String(e)).split('\n')[0];
      const left = transactional(sequelize)
        ? 'nothing of it was kept'
        : 'this database does not undo schema changes: what it did before failing is still there, undo it by hand before running it again';
      throw new Error(`the migration ${m.name} failed${direction === 'down' ? ' to revert' : ''}: ${reason}\n${left}`);
    }
  } finally {
    if (lite) await sequelize.query('PRAGMA foreign_keys = ON');
  }
}

/** Applies the pending migrations (up to `to`, when given); returns their names. `each` hears every one as it is done. */
export async function up(dir: string, sequelize: Sequelize, to?: string, each: (name: string) => void = () => undefined): Promise<string[]> {
  const all = await status(dir, sequelize);
  const last = to === undefined ? all.length - 1 : find(all, to, dir);
  const done: string[] = [];
  for (const m of all.slice(0, last + 1).filter((m) => !m.applied)) {
    await run(sequelize, m.migration, 'up');
    done.push(m.name);
    each(m.name);
  }
  return done;
}

/** Reverts the last applied migration, or every one made after `to`; returns their names, the last one first. */
export async function down(dir: string, sequelize: Sequelize, to?: string, each: (name: string) => void = () => undefined): Promise<string[]> {
  const all = await status(dir, sequelize);
  const on = all.filter((m) => m.applied);
  if (to !== undefined && !all[find(all, to, dir)].applied) throw new Error(`the migration ${all[find(all, to, dir)].name} is not applied`);
  const keep = to === undefined ? on.length - 1 : find(all, to, dir) + 1;
  const done: string[] = [];
  for (const m of on.slice(Math.max(keep, 0)).reverse()) {
    await run(sequelize, m.migration, 'down');
    done.push(m.name);
    each(m.name);
  }
  return done;
}

/** The database of the app's configuration, without the Nest app: one connection, so a migration's transaction holds
 * everything it runs. */
export function databaseOfApp(config: AppConfig, models: unknown[]): Sequelize {
  const { uri, autoLoadModels: _a, synchronize: _s, ...options } = databaseOf(config) as Record<string, unknown> & { uri?: string };
  const all = { ...options, logging: false, models: models as never, pool: { max: 1, min: 1 } };
  return uri ? new Sequelize(uri, all) : new Sequelize(all);
}

const USAGE = 'usage: synapsis-nest-migrate make "<message>" | up [--to <name>] | down [--to <name>] | status [--dir <folder>]';

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
    const file = await make(dir, message, app.entities);
    console.log(file ? `wrote ${file}` : 'no changes: the entities match the last migration');
    return;
  }
  const db = databaseOfApp(app.config, app.entities);
  try {
    if (command === 'status') {
      const all = await status(dir, db);
      console.log(all.length ? all.map((m) => `${m.applied ? 'applied' : 'pending'}  ${m.name}`).join('\n') : `no migrations in ${dir}`);
    } else if (command === 'up') {
      const done = await up(dir, db, flag('--to'), (name) => console.log(`applied ${name}`));
      if (!done.length) console.log('the database is up to date');
    } else {
      const done = await down(dir, db, flag('--to'), (name) => console.log(`reverted ${name}`));
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
