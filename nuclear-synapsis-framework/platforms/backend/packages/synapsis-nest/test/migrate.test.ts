// ADR-backend-0001, ADR-backend-0002: migrations from the entities, compared with the migrations before, applied to and
// reverted from SQLite with TypeORM's rules (the same cases as packages/synapsis-py/tests/test_migrate.py).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, it } from 'node:test';
import { AutoIncrement, BelongsTo, Column, DataType, PrimaryKey, Sequelize, Table } from 'sequelize-typescript';
import { Entity } from '../src/index.js';
import { down, make, status, up } from '../src/migrate.js';

const rejected = (work: Promise<unknown>): Promise<string> => work.then(() => assert.fail('it did not fail'), (e: Error) => e.message);

// the first version of the app: projects and their tasks
@Table({ tableName: 'projects', underscored: true, timestamps: false })
class Project extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;
}

/** The tasks of a version of the projects; from the second version on a task has `done` and a longer title. */
function tasksOf(project: () => typeof Entity, second: boolean): typeof Entity {
  @Table({ tableName: 'tasks', underscored: true, timestamps: false })
  class Task extends Entity {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;
    @Column({ type: DataType.STRING(second ? 300 : 200), allowNull: false })
    declare title: string;
    @BelongsTo(project as never, { foreignKey: 'projectId', onDelete: 'cascade' })
    declare project?: Entity;
    @Column({ type: DataType.INTEGER, allowNull: true })
    declare projectId?: number;
  }
  if (second) Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })(Task.prototype, 'done');
  return Task;
}

// the third: the name of a project (a table other rows point to) gets longer and unique
@Table({ tableName: 'projects', underscored: true, timestamps: false })
class ProjectV3 extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(150), allowNull: false, unique: true })
  declare name: string;
}

// a required column without a default
@Table({ tableName: 'projects', underscored: true, timestamps: false })
class ProjectV4 extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;
  @Column({ type: DataType.STRING(8), allowNull: false })
  declare code: string;
}

const V1 = [Project, tasksOf(() => Project, false)];
// the second: a task gets `done`, its title gets longer
const V2 = [Project, tasksOf(() => Project, true)];
const V3 = [ProjectV3, tasksOf(() => ProjectV3, true)];
const V4 = [ProjectV4, tasksOf(() => ProjectV4, false)];
// the name of a project unique, made by someone who does not have `done` yet
const V5 = [ProjectV3, tasksOf(() => ProjectV3, false)];

// another key
@Table({ tableName: 'projects', underscored: true, timestamps: false })
class ProjectKey extends Entity {
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare id: number;
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare key: number;
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;
}

/** A migrations folder and its database; `made` is `make` at an hour of its own, by the migration's name. */
async function project(work: (p: { dir: string; db: Sequelize; made: (message: string, models: unknown[]) => Promise<string>; sql: <T = Record<string, unknown>>(s: string) => Promise<T[]> }) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'synapsis-migrations-'));
  const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  let hour = 10;
  try {
    await work({
      dir,
      db,
      made: async (message, models) => basename((await make(dir, message, models, new Date(2026, 10, 10, hour++, 0, 0)))!, '.js'),
      sql: (s) => db.query(s, { type: s.startsWith('INSERT') ? 'RAW' : 'SELECT' }) as never,
    });
  } finally {
    await db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const states = async (dir: string, db: Sequelize): Promise<string[]> => (await status(dir, db)).flatMap((m) => [m.applied ? 'applied' : 'pending', m.name]);

describe('migrations', () => {
  it('make, up and down follow the entities and keep the data', () =>
    project(async ({ dir, db, made, sql }) => {
      assert.deepEqual(await status(dir, db), []);
      assert.deepEqual(await up(dir, db), [], 'the database is up to date');
      assert.deepEqual(await down(dir, db), [], 'no migration is applied');
      const first = await made('projects and tasks', V1);
      assert.equal(first, '20261110100000_projects_and_tasks');
      // created in the order of their references: projects before tasks
      const text = readFileSync(join(dir, `${first}.js`), 'utf8');
      assert.ok(text.indexOf('createTable("projects"') < text.indexOf('createTable("tasks"'));
      assert.equal(await make(dir, 'nothing', V1), null, 'no changes, no migration');
      assert.deepEqual(await states(dir, db), ['pending', first]);
      assert.deepEqual(await up(dir, db), [first]);
      await sql("INSERT INTO projects (id, name) VALUES (1, 'home')");
      await sql("INSERT INTO tasks (id, title, project_id) VALUES (1, 'paint', 1)");

      const second = await made('Done tasks!', V2);
      assert.equal(second, '20261110110000_done_tasks');
      assert.equal(await make(dir, 'again', V2), null);
      assert.deepEqual(await up(dir, db), [second]);
      assert.deepEqual(await up(dir, db), [], 'nothing pending');
      assert.deepEqual(await states(dir, db), ['applied', first, 'applied', second]);
      // the history: one row per migration applied
      assert.deepEqual(await sql('SELECT id, timestamp, name FROM migrations'), [
        { id: 1, timestamp: 20261110100000, name: first },
        { id: 2, timestamp: 20261110110000, name: second },
      ]);
      const [row] = await sql<{ title: string; done: number }>('SELECT title, done FROM tasks');
      assert.equal(row.title, 'paint', 'the data stays');
      assert.equal(Number(row.done), 0);

      assert.deepEqual(await down(dir, db), [second]);
      assert.ok(!('done' in (await db.getQueryInterface().describeTable('tasks'))));
      assert.deepEqual(await down(dir, db), [first]);
      assert.deepEqual(await down(dir, db), []);
      const tables = (await sql<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
      assert.deepEqual(tables.filter((t) => !['migrations', 'sqlite_sequence'].includes(t)), []);
      assert.equal(readdirSync(dir).length, 2);
    }));

  it('a changed column keeps the rows, the key and the constraints', () =>
    project(async ({ dir, db, made, sql }) => {
      await made('first', V2);
      await up(dir, db);
      await sql("INSERT INTO projects (id, name) VALUES (1, 'home')");
      await sql("INSERT INTO tasks (id, title, project_id) VALUES (1, 'paint', 1)");

      await made('unique names', V3);
      await up(dir, db);
      // the table the tasks point to was rebuilt: its rows and theirs are there, its ids are still generated once
      assert.equal((await sql('SELECT * FROM projects')).length, 1);
      assert.equal((await sql('SELECT * FROM tasks')).length, 1);
      const table = async (): Promise<string> => (await sql<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'projects'"))[0].sql;
      assert.match(await table(), /AUTOINCREMENT/);
      assert.match(await table(), /uq_projects_name/);
      assert.match(await table(), /VARCHAR\(150\)/);
      const keys = await sql<{ table: string; from: string; to: string }>("SELECT * FROM pragma_foreign_key_list('tasks')");
      assert.deepEqual(keys.map((k) => [k.table, k.from, k.to]), [['projects', 'project_id', 'id']]);
      await assert.rejects(sql("INSERT INTO projects (name) VALUES ('home')"), 'the name of a project is unique');

      await down(dir, db);
      assert.match(await table(), /AUTOINCREMENT/);
      assert.doesNotMatch(await table(), /uq_projects_name/);
      assert.match(await table(), /VARCHAR\(100\)/);
      assert.equal((await sql('SELECT * FROM tasks')).length, 1, 'the rows that point to the rebuilt table stay');
      await sql("INSERT INTO projects (name) VALUES ('home')"); // unique no more
    }));

  it('make warns of what loses data and refuses a changed key', () =>
    project(async ({ dir, made }) => {
      await made('first', V2);
      const warnings: string[] = [];
      const warn = console.warn;
      console.warn = (line: string) => void warnings.push(line);
      try {
        await made('less and more', V4);
      } finally {
        console.warn = warn;
      }
      assert.ok(warnings.includes('warning: the migration drops column tasks.done; if it was renamed, edit it'), warnings.join('\n'));
      assert.ok(warnings.includes('warning: the migration adds the required column projects.code without a default: a table with rows refuses it'));
      // the key of a table: no migration changes it, and make says so
      const text = await rejected(make(dir, 'another key', [ProjectKey, tasksOf(() => ProjectKey, false)]));
      assert.ok(text.startsWith('the key of projects changed (id to key): a migration does not change a key'), text);
      assert.equal(readdirSync(dir).length, 2);
    }));

  it('a failed migration is not applied', () =>
    project(async ({ dir, db, made, sql }) => {
      const first = await made('first', V1);
      const name = await made('done', V2);
      const file = join(dir, `${name}.js`);
      const good = readFileSync(file, 'utf8');
      writeFileSync(file, good.replace('\n}\n', '\n  await queryInterface.sequelize.query("SELECT * FROM nothing");\n}\n'));
      const columns = async (): Promise<string[]> => Object.keys(await db.getQueryInterface().describeTable('tasks'));
      const kept: string[] = [];
      const each = (applied: string): void => void kept.push(applied);
      // one transaction for the whole run: nothing of it stays, the migration before the failed one neither
      let text = await rejected(up(dir, db, { each }));
      assert.ok(text.startsWith(`the migration ${name} failed:`) && text.endsWith('nothing of this run was kept'), text);
      assert.deepEqual(kept, []);
      assert.deepEqual(await states(dir, db), ['pending', first, 'pending', name]);
      assert.deepEqual(await sql("SELECT name FROM sqlite_master WHERE name IN ('projects', 'tasks')"), []);
      // one transaction per migration: the ones before the failed one stay
      text = await rejected(up(dir, db, { each, transaction: 'each' }));
      assert.ok(text.endsWith('nothing of it was kept'), text);
      assert.deepEqual(kept, [first]);
      assert.ok(!(await columns()).includes('done'), 'what the migration did before failing is undone');
      assert.deepEqual(await states(dir, db), ['applied', first, 'pending', name]);
      // no transaction: what it did before failing stays
      text = await rejected(up(dir, db, { transaction: 'none' }));
      assert.match(text, /it ran without a transaction: what it did before failing is still there/);
      assert.ok((await columns()).includes('done'));
      assert.deepEqual(await states(dir, db), ['applied', first, 'pending', name]);
      // brought under the history without running it
      writeFileSync(file, `${good}\n`);
      assert.deepEqual(await up(dir, db, { fake: true }), [name]);
      assert.deepEqual(await down(dir, db, { fake: true }), [name]);
      assert.ok((await columns()).includes('done'));
      assert.deepEqual(await states(dir, db), ['applied', first, 'pending', name]);
      await up(dir, db, { fake: true });
      assert.deepEqual(await down(dir, db), [name]);
      assert.ok(!(await columns()).includes('done'));
    }));

  it('the history is what was applied', () =>
    project(async ({ dir, db, made }) => {
      const first = await made('first', V1);
      const second = await made('done', V2);
      const third = await made('unique names', V3);
      const file = join(dir, `${second}.js`);

      // up to a migration, down to a migration (its name, or the timestamp it starts with)
      assert.deepEqual(await up(dir, db, { to: second.slice(0, 14) }), [first, second]);
      assert.deepEqual(await states(dir, db), ['applied', first, 'applied', second, 'pending', third]);
      assert.equal(await rejected(down(dir, db, { to: third })), `the migration ${third} is not applied`);
      assert.match(await rejected(up(dir, db, { to: 'nothing' })), /^no migration nothing in/);
      await up(dir, db);
      assert.deepEqual(await down(dir, db, { to: first }), [third, second]);
      assert.deepEqual(await down(dir, db, { to: first }), [], 'nothing to revert');

      // a pending migration older than an applied one runs, and `down` reverts the last one applied, not the newest
      renameSync(file, `${file}.later`);
      assert.deepEqual(await up(dir, db), [third]);
      renameSync(`${file}.later`, file);
      assert.deepEqual(await states(dir, db), ['applied', first, 'pending', second, 'applied', third]);
      assert.deepEqual(await up(dir, db), [second]);
      assert.deepEqual(await down(dir, db), [second]);
      await up(dir, db);

      // a migration the database has and the folder does not: nothing but its revert needs the file
      renameSync(file, `${file}.gone`);
      assert.deepEqual(await states(dir, db), ['applied', first, 'applied', third]);
      assert.deepEqual(await up(dir, db), []);
      assert.match(await rejected(down(dir, db)), new RegExp(`^the migration ${second} is applied and is not in`));
      renameSync(`${file}.gone`, file);
      assert.deepEqual(await down(dir, db), [second]);
    }));

  it('two migrations made at the same time both count', () =>
    project(async ({ dir, db, made, sql }) => {
      await made('first', V1);
      const mine = await made('done', V2);
      renameSync(join(dir, `${mine}.js`), join(dir, `${mine}.theirs`));
      const yours = await made('unique names', V5);
      renameSync(join(dir, `${mine}.theirs`), join(dir, `${mine}.js`));
      // the entities with both changes: nothing left to make, and both apply
      assert.equal(await make(dir, 'nothing', V3), null);
      assert.deepEqual((await up(dir, db)).slice(1), [mine, yours]);
      assert.ok('done' in (await db.getQueryInterface().describeTable('tasks')));
      assert.match((await sql<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'projects'"))[0].sql, /uq_projects_name/);
    }));

  it('a database migrated by an older version goes on', () =>
    // before 0.93 the history was SequelizeMeta (the files' names) and a migration had no `parent` or had to have one
    project(async ({ dir, db, made, sql }) => {
      const first = await made('first', V5);
      const second = await made('done', V3);
      const bare = join(dir, `${first}.js`);
      writeFileSync(bare, readFileSync(bare, 'utf8').replace(/\/\/ the migrations this one was made after[^]*?\n\n/, ''));
      assert.ok(!readFileSync(bare, 'utf8').includes('export const known'));
      const old = join(dir, `${second}.js`);
      writeFileSync(old, readFileSync(old, 'utf8').replace(/export const known = .*;/, `export const parent = "${first}";`));
      assert.ok(readFileSync(old, 'utf8').includes('export const parent'));
      await up(dir, db);
      await sql('DROP TABLE migrations');
      await sql('CREATE TABLE `SequelizeMeta` (`name` VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY)');
      await sql(`INSERT INTO \`SequelizeMeta\` VALUES ('${second}.js'), ('${first}.js')`);

      assert.deepEqual(await states(dir, db), ['applied', first, 'applied', second]);
      assert.deepEqual((await sql<{ name: string }>('SELECT name FROM migrations ORDER BY id')).map((r) => r.name), [first, second]);
      assert.equal(await make(dir, 'nothing', V3), null);
      // the unique goes: it is found by its column
      const third = await made('names again', V2);
      assert.deepEqual(await up(dir, db), [third]);
      await sql("INSERT INTO projects (name) VALUES ('home')");
      await sql("INSERT INTO projects (name) VALUES ('home')");
      await assert.rejects(down(dir, db, { to: first }), 'two rows with one name: the unique cannot come back');
      await sql('DELETE FROM projects');
      assert.deepEqual(await down(dir, db, { to: first }), [third, second]);
    }));
});
