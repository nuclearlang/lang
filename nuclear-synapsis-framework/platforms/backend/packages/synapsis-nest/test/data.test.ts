// ADR-backend-0001: relations, explicit loading, pagination and transactions over SQLite in memory (the same as
// packages/synapsis-py/tests/test_data.py).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  AutoIncrement, BelongsTo, BelongsToMany, Column, DataType, HasMany, PrimaryKey, Sequelize, Table,
} from 'sequelize-typescript';
import { AppError, Conflict, Entity, Err, ErrorFilter, Ok, Repository, Result, ilike, joinTable, transactional } from '../src/index.js';

@Table({ tableName: 'projects', underscored: true, timestamps: false })
class Project extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;
  @HasMany(() => Task, { foreignKey: 'projectId', constraints: false })
  declare tasks?: Task[];
}

@Table({ tableName: 'tasks', underscored: true, timestamps: false })
class Task extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING, allowNull: false })
  declare title: string;
  @BelongsTo(() => Project, { foreignKey: 'projectId', onDelete: 'cascade' })
  declare project?: Project;
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare projectId?: number;
  @Column({ type: DataType.STRING, allowNull: true })
  declare note?: string;
  @Column({ type: DataType.DATE(6), allowNull: true })
  declare dueAt?: Date;
  @BelongsToMany(() => Tag, joinTable('tasks_tags', 'task_id', 'tag_id'))
  declare tags?: Tag[];
}

@Table({ tableName: 'tags', underscored: true, timestamps: false })
class Tag extends Entity {
  @PrimaryKey
  @Column({ type: DataType.STRING(36), defaultValue: DataType.UUIDV4 })
  declare id: string;
  @Column({ type: DataType.STRING, allowNull: false })
  declare label: string;
  @BelongsToMany(() => Task, joinTable('tasks_tags', 'tag_id', 'task_id'))
  declare tasks?: Task[];
}

// what a database refuses for integrity: a unique column, a required one, a foreign key without a rule
@Table({ tableName: 'members', underscored: true, timestamps: false })
class Member extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare email: string;
  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;
  @BelongsTo(() => Project, { foreignKey: 'projectId', onDelete: 'NO ACTION' })
  declare project?: Project;
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare projectId?: number;
}

class Enroll {
  constructor(readonly members: Repository<Member>) {}

  @transactional
  async exec(email: string): Promise<Result<AppError, number>> {
    await this.members.save(new Member({ email: `new-${email}`, name: 'written before the refusal' }));
    await this.members.save(new Member({ email, name: 'again' }));
    return Ok(1);
  }
}

/** What the app answers for an error a route let go: the status and the body `ErrorFilter` writes. */
function answered(e: unknown): [number, unknown] {
  let got: [number, unknown] = [0, null];
  const res = { status: (n: number) => ({ json: (v: unknown) => void (got = [n, v]) }) };
  new ErrorFilter().catch(e, { switchToHttp: () => ({ getResponse: () => res }) } as never);
  return got;
}

class MoveTasks {
  constructor(readonly tasks: Repository<Task>, readonly projects: Repository<Project>) {}

  @transactional
  async exec(source: number, target: number, fail: boolean): Promise<Result<AppError, number>> {
    const moved = await this.tasks.where({ projectId: source }).update({ projectId: target });
    await this.projects.save(new Project({ name: 'audit' }));
    if (fail) return Err(new Conflict('rolled back'));
    return Ok(moved);
  }
}

describe('data (ADR-backend-0001)', () => {
  let db: Sequelize;
  before(async () => {
    db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, models: [Project, Task, Tag, Member] });
    await db.sync();
  });
  after(() => db.close());

  it('loads relations explicitly, pages, and rolls a transaction back', async () => {
    const projects = new Repository(Project);
    const tasks = new Repository(Task);
    const tags = new Repository(Tag);
    const home = await projects.save(new Project({ name: 'home' }));
    const work = await projects.save(new Project({ name: 'work' }));
    const urgent = await tags.save(new Tag({ label: 'urgent' }));
    assert.equal(urgent.id.length, 36);
    for (let i = 0; i < 5; i++) {
      await tasks.save(new Task({ title: `t${i}`, projectId: home.id, ...(i === 0 ? { tags: [urgent] } : {}) }));
    }
    const join = await db.getQueryInterface().describeTable('tasks_tags');
    assert.deepEqual(Object.keys(join).sort(), ['tag_id', 'task_id']);

    const loaded = (await projects.where({ id: home.id }).relations('tasks.tags').getOne()).value;
    const body = JSON.parse(JSON.stringify(loaded)) as { tasks: { title: string; tags: { label: string }[] }[] };
    assert.deepEqual(body.tasks.map((t) => t.title), ['t0', 't1', 't2', 't3', 't4']);
    assert.equal(body.tasks[0].tags[0].label, 'urgent');
    assert.ok(!('project' in body.tasks[0])); // not loaded: absent, not null
    assert.ok(!('tasks' in JSON.parse(JSON.stringify((await projects.find(home.id)).value))));

    const page = await tasks.query().orderBy('id').paginate(3, 2);
    assert.deepEqual([page.page, page.size, page.total, page.pages], [3, 2, 5, 3]);
    assert.deepEqual(page.items.map((t) => t.title), ['t4']);

    const move = new MoveTasks(tasks, projects);
    assert.ok((await move.exec(home.id, work.id, true)).isErr);
    assert.equal(await tasks.where({ projectId: home.id }).count(), 5); // rolled back
    assert.equal(await projects.count(), 2);
    const done = await move.exec(home.id, work.id, false);
    assert.equal(done.value, 5);
    assert.equal(await projects.count(), 3);

    await projects.remove(work.id); // ON DELETE CASCADE
    assert.equal(await tasks.count(), 0);
  });

  // the same cases as test_data.py: what Spring's DataIntegrityViolationException covers answers 409 `conflict`
  it('answers 409 for what the database refuses for integrity, and rolls the transaction back', async () => {
    const projects = new Repository(Project);
    const members = new Repository(Member);
    const conflict = [409, { status: 409, message: 'conflict' }];
    const refused = async (work: () => Promise<unknown>): Promise<[number, unknown]> => work().then(() => assert.fail('it was kept'), answered);
    const team = await projects.save(new Project({ name: 'team' }));
    const ana = await members.save(new Member({ email: 'ana@x.co', name: 'Ana', projectId: team.id }));
    // a repeated unique value, a foreign key that points at nothing, a row others point to, a null in a required column
    assert.deepEqual(await refused(() => members.save(new Member({ email: 'ana@x.co', name: 'Other' }))), conflict);
    assert.deepEqual(await refused(() => members.save(new Member({ email: 'luis@x.co', name: 'Luis', projectId: 999 }))), conflict);
    assert.deepEqual(await refused(() => projects.remove(team.id)), conflict);
    assert.deepEqual(await refused(() => members.save(new Member({ email: 'eva@x.co' }))), conflict);
    assert.deepEqual(await refused(() => members.where({ id: ana.id }).update({ name: null })), conflict);
    // a text longer than its column, counted in characters: 20 of them fit whatever bytes they take
    assert.deepEqual(await refused(() => members.save(new Member({ email: 'e'.repeat(21), name: 'long' }))), conflict);
    assert.deepEqual(await refused(() => members.save(new Member({ email: 'long@x.co', name: 'n'.repeat(256) }))), conflict);
    assert.deepEqual(await refused(() => members.where({ id: ana.id }).update({ email: 'e'.repeat(21) })), conflict);
    assert.equal((await members.save(new Member({ email: '😀'.repeat(20), name: 'ñ'.repeat(255) }))).email, '😀'.repeat(20));
    assert.equal(await members.count(), 2);
    // inside @transactional what was written before the refusal is not kept
    assert.deepEqual(await refused(() => new Enroll(members).exec('ana@x.co')), conflict);
    assert.equal(await members.where({ email: 'new-ana@x.co' }).count(), 0);
    assert.equal((await new Enroll(members).exec('eva@x.co')).value, 1);
    assert.equal(await members.count(), 4);
    // anything else the database says is still a 500 that does not say why
    assert.deepEqual(await refused(() => db.query('SELECT * FROM no_such_table')), [500, { status: 500, message: 'error' }]);
  });

  // what packages/synapsis-py/tests/test_data.py checks too: found running one project with both dialects on
  // PostgreSQL, MySQL, MariaDB and SQLite (checks/database-check)
  it('answers the same rows as every dialect', async () => {
    const projects = new Repository(Project);
    const tasks = new Repository(Task);
    const tags = new Repository(Tag);
    const home = await projects.save(new Project({ name: 'Home Sweet' }));
    const due = new Date('2026-03-04T05:06:07.123+02:00');
    const task = await tasks.save(new Task({ title: 'paint', projectId: home.id, dueAt: due }));
    assert.equal(task.note, null); // a column left out is null in the row `save` answers
    assert.equal(await projects.where({ name: ilike('%SWEET%') }).count(), 1); // any case, on every database

    const found = (await tasks.find(task.id)).value;
    assert.equal(found.dueAt?.getTime(), due.getTime()); // an instant

    const a = await tags.save(new Tag({ label: 'a' }));
    const b = await tags.save(new Tag({ label: 'b' }));
    found.tags = [a, b]; // a list set on a found row replaces its rows of the join table
    await tasks.save(found);
    const again = (await tasks.find(task.id)).value;
    again.tags = [b];
    await tasks.save(again);

    const loaded = (await projects.where({ id: home.id }).relations('tasks.tags').getOne()).value;
    const body = JSON.parse(JSON.stringify(loaded)) as { tasks: { tags: { label: string }[]; dueAt: string; projectId: number; note: null }[] };
    const row = body.tasks[0];
    assert.deepEqual(row.tags.map((t) => t.label), ['b']);
    assert.deepEqual(Object.keys(row.tags[0]).sort(), ['id', 'label']); // the related row only, with Nuclear's names
    assert.deepEqual([row.dueAt, row.projectId, row.note], ['2026-03-04T03:06:07.123Z', home.id, null]);
  });
});
