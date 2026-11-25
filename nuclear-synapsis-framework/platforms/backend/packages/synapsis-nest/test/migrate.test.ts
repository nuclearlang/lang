// ADR-backend-0001, ADR-backend-0002: migrations from the entities, compared with the migrations before, applied to and
// reverted from SQLite with TypeORM's rules (the same cases as packages/synapsis-py/tests/test_migrate.py).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, it } from 'node:test';
import { AutoIncrement, BelongsTo, BelongsToMany, Column, CreatedAt, DataType, PrimaryKey, Sequelize, Table, UpdatedAt } from 'sequelize-typescript';
import { Database, Entity, exactColumn, exactText, joinTable } from '../src/index.js';

/** What the plugin `sqlite` writes in a project (ADR-backend-0004). */
class SQLite extends Database {
  readonly dialect = 'sqlite';
}
import { BigDouble } from '../src/exact.js';
import { createTables, down, make, status, textType, up } from '../src/migrate.js';

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

// the projects renamed to teams, and their name to title
@Table({ tableName: 'teams', underscored: true, timestamps: false })
class Team extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare title: string;
}
const V6 = [Team, tasksOf(() => Team, true)];

/** A table with a text of `length` characters. */
function essays(length: number): unknown[] {
  @Table({ tableName: 'essays', underscored: true, timestamps: false })
  class Essay extends Entity {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;
    @Column({ type: DataType.STRING(length), allowNull: false })
    declare body: string;
  }
  return [Essay];
}

// exact numbers: a bigint, a bigdouble of a precision and a scale, and a second one with a default
function prices(precision: number, scale: number, rate: boolean): unknown[] {
  @Table({ tableName: 'prices', underscored: true, timestamps: false })
  class Price extends Entity {
    @PrimaryKey
    @AutoIncrement
    @Column(DataType.INTEGER)
    declare id: number;
    @Column({ type: DataType.BIGINT, allowNull: false, ...exactColumn('code') })
    declare code: bigint;
    @Column({ type: DataType.DECIMAL(precision, scale), allowNull: false, ...exactColumn('amount', precision, scale) })
    declare amount: BigDouble;
  }
  @Table({ tableName: 'prices', underscored: true, timestamps: false })
  class PriceWithRate extends Price {
    @Column({ type: DataType.DECIMAL(30, 10), allowNull: false, defaultValue: exactText(BigDouble.of('1.5'), 10), ...exactColumn('rate', 30, 10) })
    declare rate: BigDouble;
  }
  return [rate ? PriceWithRate : Price];
}

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

// an app with every kind of thing `createTables` and a migration must write the same way: a unique, defaults, a
// `DateTime`, the timestamps, a foreign key, a join table (as the dialect writes its entities)
@Table({ tableName: 'labels', underscored: true, timestamps: false })
class Label extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(30), allowNull: false, unique: true })
  declare text: string;
}

@Table({ tableName: 'stamped', underscored: true, timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' })
class Stamped extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(100), allowNull: false, unique: true })
  declare name: string;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare open: boolean;
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0.5 })
  declare cost: number;
  @Column({ type: DataType.DATE(6), allowNull: true })
  declare due?: Date;
  @BelongsTo(() => Stamped, { foreignKey: 'ownerId', onDelete: 'set null', onUpdate: 'NO ACTION' })
  declare owner?: Stamped;
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare ownerId?: number;
  @BelongsToMany(() => Label, joinTable('stamped_labels', 'stamped_id', 'label_id'))
  declare labels?: Label[];
  @CreatedAt
  @Column({ type: DataType.DATE(6), allowNull: false })
  declare createdAt?: Date;
  @UpdatedAt
  @Column({ type: DataType.DATE(6), allowNull: false })
  declare updatedAt?: Date;
}

/** Every table as SQLite has it, by the words it was made with. */
const tables = async (db: Sequelize): Promise<Record<string, string>> =>
  Object.fromEntries(
    ((await db.query("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT IN ('migrations', 'sqlite_sequence') ORDER BY name", { type: 'SELECT' })) as { name: string; sql: string }[]).map((t) => [t.name, t.sql]),
  );

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
      assert.ok(warnings.includes('warning: the migration drops column tasks.done, with its values; if it was renamed, delete this migration and make it with --rename tasks.done=<new column>'), warnings.join('\n'));
      assert.ok(warnings.includes('warning: the migration adds the required column projects.code without a default: a table with rows refuses it'));
      // the key of a table: no migration changes it, and make says so
      const text = await rejected(make(dir, 'another key', [ProjectKey, tasksOf(() => ProjectKey, false)]));
      assert.ok(text.startsWith('the key of projects changed (id to key): a migration does not change a key'), text);
      assert.equal(readdirSync(dir).length, 2);
    }));

  it('make --rename writes a rename that keeps the rows, and refuses one that is not there', () =>
    project(async ({ dir, db, made, sql }) => {
      await made('first', V2);
      await up(dir, db);
      await sql("INSERT INTO projects (id, name) VALUES (1, 'home')");
      await sql("INSERT INTO tasks (id, title, project_id) VALUES (1, 'paint', 1)");
      const at = new Date(2026, 10, 10, 20, 0, 0);
      // refused, with the same words in every dialect; nothing is written
      const refusals: [unknown[], string[], string][] = [
        [V6, ['nothing=teams'], 'cannot rename nothing: the migrations have no table nothing'],
        [V2, ['projects=teams'], 'cannot rename projects: the entities still have the table projects'],
        [V6, ['projects=crews'], 'cannot rename projects to crews: the entities have no table crews'],
        [V6, ['projects=tasks'], 'cannot rename projects to tasks: the migrations already have the table tasks'],
        [V6, ['projects=teams', 'projects.nope=title'], 'cannot rename projects.nope: the migrations have no column projects.nope'],
        [V6, ['projects=teams', 'projects.id=title'], 'cannot rename projects.id: the entities still have the column projects.id'],
        [V6, ['projects=teams', 'projects.name=label'], 'cannot rename projects.name to label: the entities have no column teams.label'],
        [V6, ['projects=teams', 'projects.name=id'], 'cannot rename projects.name to id: the migrations already have the column teams.id'],
        [V6, ['projects'], '--rename takes <table>=<new table> or <table>.<column>=<new column>, not projects'],
      ];
      for (const [models, renames, message] of refusals) assert.equal(await rejected(make(dir, 'teams', models, at, renames)), message);
      assert.equal(readdirSync(dir).length, 1);

      const file = (await make(dir, 'teams', V6, at, ['projects=teams', 'projects.name=title']))!;
      const text = readFileSync(file, 'utf8');
      assert.match(text, /renameTable\("projects", "teams"\);\n  await queryInterface.renameColumn\("teams", "name", "title"\);/);
      assert.match(text, /renameColumn\("teams", "title", "name"\);\n  await queryInterface.renameTable\("teams", "projects"\);/);
      assert.doesNotMatch(text.slice(0, text.indexOf('export const known')), /dropTable|createTable|removeColumn|addColumn|changeColumn/);
      assert.equal(await make(dir, 'again', V6), null, 'the rename is all that changed');
      await up(dir, db);
      assert.deepEqual(await sql('SELECT id, title FROM teams'), [{ id: 1, title: 'home' }], 'the rows stay');
      const keys = async (): Promise<string[][]> => (await sql<{ table: string; from: string; to: string }>("SELECT * FROM pragma_foreign_key_list('tasks')")).map((k) => [k.table, k.from, k.to]);
      assert.deepEqual(await keys(), [['teams', 'project_id', 'id']], 'the rows that point to it follow');
      await down(dir, db);
      assert.deepEqual(await sql('SELECT id, name FROM projects'), [{ id: 1, name: 'home' }]);
      assert.deepEqual(await keys(), [['projects', 'project_id', 'id']]);
      assert.equal((await sql('SELECT * FROM tasks')).length, 1);
    }));

  it('a text column is the VARCHAR of its length, or the text type that holds it', () =>
    project(async ({ dir, db, made, sql }) => {
      // the one rule, the same as the fastapi dialect's runtime (tests/test_migrate.py)
      const rule = (n: number): string[] => ['sqlite', 'postgres', 'mysql', 'mariadb'].map((d) => textType(d, n));
      assert.deepEqual(rule(255), ['VARCHAR(255)', 'VARCHAR(255)', 'VARCHAR(255)', 'VARCHAR(255)']);
      assert.deepEqual(rule(16383), ['VARCHAR(16383)', 'VARCHAR(16383)', 'VARCHAR(16383)', 'VARCHAR(16383)']);
      assert.deepEqual(rule(16384), ['VARCHAR(16384)', 'VARCHAR(16384)', 'MEDIUMTEXT', 'MEDIUMTEXT']);
      assert.deepEqual(rule(4194303), ['VARCHAR(4194303)', 'VARCHAR(4194303)', 'MEDIUMTEXT', 'MEDIUMTEXT']);
      assert.deepEqual(rule(4194304), ['VARCHAR(4194304)', 'VARCHAR(4194304)', 'LONGTEXT', 'LONGTEXT']);
      assert.deepEqual(rule(10485760), ['VARCHAR(10485760)', 'VARCHAR(10485760)', 'LONGTEXT', 'LONGTEXT']);
      assert.deepEqual(rule(10485761), ['VARCHAR(10485761)', 'TEXT', 'LONGTEXT', 'LONGTEXT']);
      // a changed length is a migration, in both directions
      const type = async (): Promise<string> => (await sql<{ type: string }>("SELECT type FROM pragma_table_info('essays') WHERE name = 'body'"))[0].type;
      await made('essays', essays(100000));
      await up(dir, db);
      assert.equal(await type(), 'VARCHAR(100000)');
      await sql("INSERT INTO essays (body) VALUES ('kept')");
      await made('shorter', essays(100));
      await up(dir, db);
      assert.equal(await type(), 'VARCHAR(100)');
      await made('longer', essays(1000000));
      await up(dir, db);
      assert.equal(await type(), 'VARCHAR(1000000)');
      await down(dir, db);
      assert.equal(await type(), 'VARCHAR(100)');
      assert.deepEqual(await sql('SELECT body FROM essays'), [{ body: 'kept' }]);
    }));

  it('an exact column is made and changed by its precision and scale', () =>
    project(async ({ dir, db, made, sql }) => {
      // a bigint is BIGINT, a bigdouble DECIMAL(p, s); SQLite keeps their text, in a type that says so (the same names as
      // tests/test_migrate.py)
      const kinds = async (): Promise<string[]> => (await sql<{ type: string }>("SELECT type FROM pragma_table_info('prices') ORDER BY cid")).map((r) => r.type);
      const first = await made('prices', prices(30, 10, false));
      assert.match(readFileSync(join(dir, `${first}.js`), 'utf8'), /DECIMAL\(\{precision: 30, scale: 10\}\)/);
      await up(dir, db);
      assert.deepEqual(await kinds(), ['INTEGER', 'EXACT TEXT', 'EXACT TEXT(30,10)']);
      await sql("INSERT INTO prices (code, amount) VALUES ('12345678901234567', '0.3000000000')");
      await made('scale', prices(20, 4, true));
      await up(dir, db);
      assert.deepEqual(await kinds(), ['INTEGER', 'EXACT TEXT', 'EXACT TEXT(20,4)', 'EXACT TEXT(30,10)']);
      assert.deepEqual(await sql('SELECT code, amount, rate FROM prices'), [{ code: '12345678901234567', amount: '0.3000', rate: '1.5000000000' }]);
      await down(dir, db);
      assert.deepEqual(await kinds(), ['INTEGER', 'EXACT TEXT', 'EXACT TEXT(30,10)']);
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

  it('createTables makes the tables of the first migration, and a DateTime gets its fraction', async () => {
    // the app's own connection, as `createTables = true` opens it: the hook makes the tables before Sequelize's sync
    const options = new SQLite({ file: ':memory:', createTables: true }).sequelize() as object;
    const app = new Sequelize({ ...options, models: [Label, Stamped] } as never);
    await app.sync();
    const created = await tables(app);
    await createTables(app); // the tables are there: nothing to make
    assert.deepEqual(await tables(app), created);
    await app.close();
    assert.deepEqual(Object.keys(created), ['labels', 'stamped', 'stamped_labels']);
    assert.match(created.stamped, /`due` DATETIME\(6\), /);
    assert.match(created.stamped, /`created_at` DATETIME\(6\) NOT NULL DEFAULT \(CURRENT_TIMESTAMP\)/);
    assert.match(created.stamped, /`open` BOOLEAN NOT NULL DEFAULT 1, `cost` DOUBLE NOT NULL DEFAULT '0.5'/);
    assert.match(created.stamped, /CONSTRAINT `uq_stamped_name` UNIQUE \(`name`\), CONSTRAINT `fk_stamped_owner_id` FOREIGN KEY \(`owner_id`\) REFERENCES `stamped` \(`id`\) ON DELETE SET NULL\)$/);
    assert.match(created.stamped_labels, /CONSTRAINT `fk_stamped_labels_stamped_id` .* ON DELETE CASCADE, CONSTRAINT `fk_stamped_labels_label_id` .* ON DELETE CASCADE\)$/);

    await project(async ({ dir, db, made, sql }) => {
      // the migration makes the same tables, word for word
      const first = await made('first', [Label, Stamped]);
      await up(dir, db);
      assert.deepEqual(await tables(db), created);
      assert.equal(await make(dir, 'nothing', [Label, Stamped]), null);

      // a migration made before 0.94 wrote a DateTime without its fraction: the next make gives it, and the rows stay
      await down(dir, db);
      const file = join(dir, `${first}.js`);
      const old = readFileSync(file, 'utf8')
        .replaceAll('Sequelize.DataTypes.DATE({length: 6})', 'Sequelize.DataTypes.DATE')
        .replaceAll('(CURRENT_TIMESTAMP)', 'CURRENT_TIMESTAMP')
        .replace(/,\s*"options": \{\s*"length": 6\s*\}/g, '');
      assert.ok(!old.includes('length: 6') && !old.includes('"length": 6'));
      writeFileSync(file, old);
      await up(dir, db);
      assert.match((await tables(db)).stamped, /`due` DATETIME, .*`created_at` DATETIME NOT NULL/);
      await sql("INSERT INTO stamped (name, due) VALUES ('home', '2026-03-04 05:06:07.089 +00:00')");
      const second = await made('the fraction', [Label, Stamped]);
      assert.match(readFileSync(join(dir, `${second}.js`), 'utf8'), /changeColumn\("stamped", "due", \{ type: Sequelize\.DataTypes\.DATE\(\{length: 6\}\)/);
      assert.deepEqual(await up(dir, db), [second]);
      const now = await tables(db);
      for (const column of ['`due` DATETIME(6)', '`created_at` DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP)', '`updated_at` DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP)']) {
        assert.ok(now.stamped.includes(column), `${column} in ${now.stamped}`);
      }
      assert.deepEqual(await sql('SELECT name, due FROM stamped'), [{ name: 'home', due: '2026-03-04 05:06:07.089 +00:00' }]);
      assert.equal(await make(dir, 'nothing', [Label, Stamped]), null);
    });
  });

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
