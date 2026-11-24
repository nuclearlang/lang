// The exact numbers on the backend (ADR-lang-0015, the platform's reference §2.1 and §2.3): a JSON text both ways,
// the language's parsing, exact columns compared and sorted by value, a value the column cannot hold refused with 409.
// The same cases, with the same expected bodies, are in synapsis-py/tests/test_exact.py.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { IsArray } from 'class-validator';
import { AutoIncrement, Column, DataType, PrimaryKey, Sequelize, Table } from 'sequelize-typescript';
import { BigDouble } from '../src/exact.js';
import {
  BigDoublePipe, BigIntPipe, Entity, IsBigDouble, IsBigInt, MaxExact, MinExact, RequiredPipe, Repository, between,
  checkModel, exactColumn, exactText, gt, gte, lt, lte, oneOf, parseBigDouble, parseBigInt,
} from '../src/index.js';
import { createTables } from '../src/migrate.js';
import { startTestApp, stopTestApp } from '../src/testing.js';

@Table({ tableName: 'amounts', underscored: true, timestamps: false })
class Amount extends Entity {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;
  @Column({ type: DataType.BIGINT, allowNull: false, ...exactColumn('big') })
  declare big: bigint;
  @Column({ type: DataType.DECIMAL(20, 4), allowNull: false, ...exactColumn('price', 20, 4) })
  declare price: BigDouble;
  @Column({ type: DataType.DECIMAL(30, 10), allowNull: false, defaultValue: exactText(BigDouble.of('1.5'), 10), ...exactColumn('rate', 30, 10) })
  declare rate: BigDouble;
  @Column({ type: DataType.DECIMAL(30, 10), allowNull: true, ...exactColumn('extra', 30, 10) })
  declare extra?: BigDouble;
}

// a model as the dialect writes it
class NewAmount {
  @IsBigInt()
  @MaxExact(12345678901234567890123n)
  big!: bigint;
  @IsBigDouble()
  price!: BigDouble;
  @IsBigDouble()
  @MinExact(BigDouble.of('0.1'))
  floor: BigDouble = BigDouble.of('1');
  @IsBigInt({ each: true })
  @IsArray()
  many: bigint[] = [];

  constructor(values?: Partial<NewAmount>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}

let amounts: Repository<Amount>;

@Controller('amounts')
class AmountController {
  @Post()
  create(@Body() input: NewAmount): Promise<Amount> {
    return amounts.save(new Amount({ big: input.big, price: input.price }));
  }

  @Get('sum')
  sum(@Query('a', RequiredPipe, BigDoublePipe) a: BigDouble, @Query('b', RequiredPipe, BigDoublePipe) b: BigDouble): BigDouble {
    return a.plus(b);
  }

  @Get('next/:n')
  next(@Param('n', RequiredPipe, BigIntPipe) n: bigint): bigint {
    return n + 1n;
  }

  @Get('sorted')
  sorted(@Query('desc') desc?: string): Promise<Amount[]> {
    return amounts.orderBy('price', { desc: desc === 'true' }).getMany();
  }

  @Get('over')
  async over(@Query('at', RequiredPipe, BigDoublePipe) at: BigDouble, @Query('how') how = 'gt'): Promise<BigDouble[]> {
    const op = ({ gt, gte, lt, lte } as Record<string, (v: unknown) => unknown>)[how]!(at);
    return (await amounts.where({ price: op }).orderBy('price').getMany()).map((a) => a.price);
  }

  @Get('within')
  async within(@Query('low', RequiredPipe, BigDoublePipe) low: BigDouble, @Query('high', RequiredPipe, BigDoublePipe) high: BigDouble): Promise<BigDouble[]> {
    return (await amounts.where({ price: between(low, high) }).orderBy('price').getMany()).map((a) => a.price);
  }

  @Get('equal')
  async equal(@Query('at', RequiredPipe, BigDoublePipe) at: BigDouble): Promise<number> {
    return (await amounts.where({ price: at }).count()) + (await amounts.where({ price: oneOf([at]) }).count());
  }

  @Get('write/:what')
  write(@Param('what') what: string): Promise<Amount> {
    const values: Record<string, [bigint, string]> = {
      beyond: [2n ** 63n, '1'], edge: [2n ** 63n - 1n, '1'], decimals: [1n, '0.00001'], digits: [1n, '12345678901234567.5'],
    };
    const [big, price] = values[what]!;
    return amounts.save(new Amount({ big, price: BigDouble.of(price) }));
  }
}

@Module({ controllers: [AmountController] })
class AmountModule {}

const refused = (field: string, rule: string, message: string): unknown => ({ status: 400, message: 'invalid', errors: [{ field, rule, message }] });

describe('the exact numbers', () => {
  let db: Sequelize;
  let base = '';
  let app: Awaited<ReturnType<typeof startTestApp>>;
  const json = { 'content-type': 'application/json' };
  const answer = async (r: Response): Promise<[number, unknown]> => [r.status, await r.json()];
  const get = async (path: string): Promise<unknown> => (await fetch(`${base}${path}`)).json();
  const post = (body: unknown): Promise<Response> => fetch(`${base}/amounts`, { method: 'POST', headers: json, body: JSON.stringify(body) });

  before(async () => {
    db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, models: [Amount] });
    await createTables(db);
    amounts = new Repository(Amount);
    app = await startTestApp(AmountModule);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });
  after(async () => {
    await stopTestApp(app);
    await db.close();
  });

  it('read the texts of the language', () => {
    assert.deepEqual([' 12 ', '+3', '-0', '1.0', '1e3', '', '0x1', '1_0'].map(parseBigInt), [12n, 3n, 0n, null, null, null, null, null]);
    assert.ok(parseBigDouble('-0.5e2')!.eq(BigDouble.of('-50')) && parseBigDouble('1.') === null && parseBigDouble('abc') === null);
    // past MAX_DIGITS: not of the type (a text like this would be a billion digits)
    assert.ok(parseBigDouble('1e999999999') === null && parseBigInt('9'.repeat(1001)) === null);
    assert.deepEqual(['0.3000', '2', '-1.25', '0E-10', '1E+3'].map((t) => BigDouble.of(t).toString()), ['0.3', '2.0', '-1.25', '0.0', '1000.0']);
    // the runtime's class is the one the dialect writes in a file that uses the type
    const written = readFileSync(fileURLToPath(new URL('../../../../../../../nuclearlang/dialects/typescript/templates/bigdouble.tpl', import.meta.url)), 'utf8');
    const own = readFileSync(fileURLToPath(new URL('../../src/exact.ts', import.meta.url)), 'utf8');
    assert.ok(own.includes(written.split('\n').slice(1).join('\n')), 'src/exact.ts has the class of templates/bigdouble.tpl');
  });

  it('are a text in JSON', async () => {
    await amounts.where({}).delete();
    assert.deepEqual(await answer(await post({ big: '1234567890123456789', price: '0.3', many: ['1', ' 2 '] })), [
      201, { id: 1, big: '1234567890123456789', price: '0.3', rate: '1.5', extra: null },
    ]);
    const whole = 'a whole number in a text';
    const decimal = 'a decimal number in a text';
    const cases: [unknown, unknown][] = [
      [{ big: 5, price: '1' }, refused('big', 'type', `big must be ${whole}`)],
      [{ big: '5.0', price: '1' }, refused('big', 'type', `big must be ${whole}`)],
      [{ big: '1', price: 0.3 }, refused('price', 'type', `price must be ${decimal}`)],
      [{ big: '1', price: '1e999999999' }, refused('price', 'type', `price must be ${decimal}`)],
      [{ big: '1', price: '1', floor: '0.05' }, refused('floor', 'min', 'floor must be at least 0.1')],
      [{ big: '12345678901234567890124', price: '1' }, refused('big', 'max', 'big must be at most 12345678901234567890123')],
      [{ big: '1', price: '1', many: ['1', 2] }, refused('many.1', 'type', `many.1 must be ${whole}`)],
    ];
    for (const [sent, body] of cases) assert.deepEqual(await answer(await post(sent)), [400, body], JSON.stringify(sent));
    // a parameter of the path or the query: the same texts
    assert.deepEqual(await answer(await fetch(`${base}/amounts/sum?a=0.1&b=0.2`)), [200, '0.3']);
    // (a text answered alone is written as the framework writes a text)
    assert.match(await (await fetch(`${base}/amounts/next/9223372036854775807`)).text(), /^"?9223372036854775808"?$/);
    assert.deepEqual(await answer(await fetch(`${base}/amounts/sum?a=0.1&b=x`)), [400, refused('b', 'type', `b must be ${decimal}`)]);
    assert.deepEqual(await answer(await fetch(`${base}/amounts/next/1.5`)), [400, refused('n', 'type', `n must be ${whole}`)]);
    // a model built in code takes the values of the program
    assert.equal(new NewAmount({ big: 5n, price: BigDouble.of('0.5') }).big, 5n);
    assert.throws(() => new NewAmount({ big: 5n, price: 0.5 as unknown as BigDouble }));
    await amounts.where({}).delete();
  });

  it('compare and sort by value', async () => {
    await amounts.where({}).delete();
    const prices = ['10', '9.5', '-2', '-10.25', '0.3', '100', '-0.5', '0'];
    for (const [i, p] of prices.entries()) assert.equal((await post({ big: String(i), price: p })).status, 201);
    const ordered = ['-10.25', '-2.0', '-0.5', '0.0', '0.3', '9.5', '10.0', '100.0'];
    assert.deepEqual(((await get('/amounts/sorted')) as { price: string }[]).map((a) => a.price), ordered);
    assert.deepEqual(((await get('/amounts/sorted?desc=true')) as { price: string }[]).map((a) => a.price), [...ordered].reverse());
    assert.deepEqual(await get('/amounts/over?at=0.3'), ['9.5', '10.0', '100.0']);
    assert.deepEqual(await get('/amounts/over?at=0.3&how=gte'), ['0.3', '9.5', '10.0', '100.0']);
    assert.deepEqual(await get('/amounts/over?at=-0.75&how=lt'), ['-10.25', '-2.0']);
    assert.deepEqual(await get('/amounts/over?at=-2&how=lte'), ['-10.25', '-2.0']);
    assert.deepEqual(await get('/amounts/over?at=9.50001'), ['10.0', '100.0']);
    assert.deepEqual(await get('/amounts/within?low=-2&high=9.5'), ['-2.0', '-0.5', '0.0', '0.3', '9.5']);
    assert.equal(await get('/amounts/equal?at=0.30'), 2);
    assert.equal(await get('/amounts/equal?at=0.30001'), 0);
    await amounts.where({}).delete();
  });

  it('refuse with 409 a value the column cannot hold', async () => {
    assert.equal(((await get('/amounts/write/edge')) as { big: string }).big, '9223372036854775807');
    for (const what of ['beyond', 'decimals', 'digits']) {
      assert.deepEqual(await answer(await fetch(`${base}/amounts/write/${what}`)), [409, { status: 409, message: 'conflict' }], what);
    }
  });
});
