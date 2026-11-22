// ADR-backend-0001: migrations from the entities, compared with the last migration, applied to and reverted from SQLite
// (the same cases as packages/synapsis-py/tests/test_migrate.py).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, it } from 'node:test';
import { AutoIncrement, BelongsTo, Column, DataType, PrimaryKey, Sequelize, Table } from 'sequelize-typescript';
import { Entity } from '../src/index.js';
import { down, make, status, up } from '../src/migrate.js';

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
      const [row] = await sql<{ title: string; done: number }>('SELECT title, done FROM tasks');
      assert.equal(row.title, 'paint', 'the data stays');
      assert.equal(Number(row.done), 0);

      assert.deepEqual(await down(dir, db), [second]);
      assert.ok(!('done' in (await db.getQueryInterface().describeTable('tasks'))));
      assert.deepEqual(await down(dir, db), [first]);
      assert.deepEqual(await down(dir, db), []);
      const tables = (await sql<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
      assert.deepEqual(tables.filter((t) => !['SequelizeMeta', 'sqlite_sequence'].includes(t)), []);
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

  it('make warns of what loses data or is refused', () =>
    project(async ({ made }) => {
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
    }));

  it('a failed migration is not applied', () =>
    project(async ({ dir, db, made }) => {
      const first = await made('first', V1);
      await up(dir, db);
      const name = await made('done', V2);
      const file = join(dir, `${name}.js`);
      const good = readFileSync(file, 'utf8');
      writeFileSync(file, good.replace('\n}\n', '\n  await queryInterface.sequelize.query("SELECT * FROM nothing");\n}\n'));
      await assert.rejects(up(dir, db), (e: Error) => e.message.startsWith(`the migration ${name} failed:`) && e.message.endsWith('nothing of it was kept'));
      assert.ok(!('done' in (await db.getQueryInterface().describeTable('tasks'))), 'what the migration did before failing is undone');
      assert.deepEqual(await states(dir, db), ['applied', first, 'pending', name]);
      writeFileSync(file, `${good}\n`);
      assert.deepEqual(await up(dir, db), [name]);
      assert.ok('done' in (await db.getQueryInterface().describeTable('tasks')));
    }));

  it('the history is one line', () =>
    project(async ({ dir, db, made }) => {
      const first = await made('first', V1);
      const second = await made('done', V2);
      const third = await made('unique names', V3);

      // up to a migration, down to a migration (its name, or the timestamp it starts with)
      assert.deepEqual(await up(dir, db, second.slice(0, 14)), [first, second]);
      assert.deepEqual(await states(dir, db), ['applied', first, 'applied', second, 'pending', third]);
      await assert.rejects(down(dir, db, third), { message: `the migration ${third} is not applied` });
      await assert.rejects(up(dir, db, 'nothing'), /^Error: no migration nothing in/);
      await up(dir, db);
      assert.deepEqual(await down(dir, db, first), [third, second]);
      assert.deepEqual(await down(dir, db, first), [], 'nothing to revert');

      // a migration the database has and the folder does not
      await up(dir, db, second);
      for (const name of [second, third]) renameSync(join(dir, `${name}.js`), join(dir, `${name}.gone`));
      for (const command of [status, up, down]) await assert.rejects(command(dir, db), /^Error: the database has the migration/);
      for (const name of [second, third]) renameSync(join(dir, `${name}.gone`), join(dir, `${name}.js`));

      // two migrations made after the same one (two people at once)
      const twin = join(dir, '29990101000000_twin.js');
      copyFileSync(join(dir, `${second}.js`), twin);
      const refused = new RegExp(`^Error: the migrations ${second} and 29990101000000_twin both follow ${first}`);
      for (const command of [status, up, down]) await assert.rejects(command(dir, db), refused);
      await assert.rejects(make(dir, 'more', V3), refused);
      unlinkSync(twin);
      assert.deepEqual(await states(dir, db), ['applied', first, 'applied', second, 'pending', third]);
    }));

  it('migrations made by an older version still run', () =>
    // before 0.91 a migration had no `parent`: the files follow each other by name
    project(async ({ dir, db, made }) => {
      const first = await made('first', V1);
      const second = await made('done', V2);
      for (const name of [first, second]) {
        const file = join(dir, `${name}.js`);
        const text = readFileSync(file, 'utf8').replace(/\/\/ the migration this one was made after[^]*?\n\n/, '');
        assert.ok(!text.includes('export const parent'));
        writeFileSync(file, text);
      }
      assert.deepEqual(await up(dir, db), [first, second]);
      assert.equal(await make(dir, 'nothing', V2), null);
      const third = await made('unique names', V3);
      assert.match(readFileSync(join(dir, `${third}.js`), 'utf8'), new RegExp(`export const parent = "${second}";`));
      assert.deepEqual(await up(dir, db), [third]);
      assert.deepEqual(await down(dir, db, first), [third, second]);
    }));
});
