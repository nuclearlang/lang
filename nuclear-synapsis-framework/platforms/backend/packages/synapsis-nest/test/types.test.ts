// A value's JSON type is its field's: nothing converts (the platform's reference, §2.3), and a model built in code is
// checked as a body is. The same cases, with the same expected bodies, are in synapsis-py/tests/test_types.py.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { IntPipe, InvalidModel, IsDateTime, checkModel } from '../src/index.js';
import { startTestApp, stopTestApp } from '../src/testing.js';

// a model as the dialect writes it
class Typed {
  @IsInt()
  count: number = 1;
  @IsNumber()
  price: number = 1.0;
  @IsBoolean()
  on: boolean = false;
  @IsString()
  @MinLength(2)
  name: string = 'name';
  @IsOptional()
  @IsDateTime()
  at?: Date;
  @IsString({ each: true })
  @IsArray()
  tags: string[] = [];
  @IsInt({ each: true })
  @IsArray()
  sizes: number[] = [];

  constructor(values?: Partial<Typed>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}

@Controller('typed')
class TypedController {
  @Post()
  create(@Body() typed: Typed): Typed {
    return typed;
  }

  @Get('built')
  built(@Query('name') name: string, @Query('count', IntPipe) count?: number): Typed {
    // a model built in code: its rules are checked here, and nothing handles what it throws
    return new Typed({ name, count: count ?? 1 });
  }
}

@Module({ controllers: [TypedController] })
class TypedModule {}

const refused = (field: string, type: string): unknown => ({ status: 400, message: 'invalid', errors: [{ field, rule: 'type', message: `${field} must be ${type}` }] });

// [what is sent, the body of the refusal]: the same list as test_types.py
const REFUSED: [unknown, unknown][] = [
  [{ count: '3' }, refused('count', 'a whole number')],
  [{ count: true }, refused('count', 'a whole number')],
  [{ count: 3.5 }, refused('count', 'a whole number')],
  [{ count: [3] }, refused('count', 'a whole number')],
  [{ price: '1.5' }, refused('price', 'a number')],
  [{ price: true }, refused('price', 'a number')],
  [{ on: 'true' }, refused('on', 'true or false')],
  [{ on: 1 }, refused('on', 'true or false')],
  [{ name: 5 }, refused('name', 'a text')],
  [{ name: true }, refused('name', 'a text')],
  [{ at: 5 }, refused('at', 'a date and time')],
  [{ at: 'soon' }, refused('at', 'a date and time')],
  [{ tags: 'a' }, refused('tags', 'a list')],
  [{ tags: ['a', 7] }, refused('tags.1', 'a text')],
  [{ sizes: [1, '2', 3.5] }, { status: 400, message: 'invalid', errors: [
    { field: 'sizes.1', rule: 'type', message: 'sizes.1 must be a whole number' },
    { field: 'sizes.2', rule: 'type', message: 'sizes.2 must be a whole number' },
  ] }],
  [{ sizes: [1, null] }, { status: 400, message: 'invalid', errors: [{ field: 'sizes.1', rule: 'required', message: 'sizes.1 is required' }] }],
];

describe('the types of a model', () => {
  it('refuse a value of another JSON type, and a model built in code is checked', async () => {
    const app = await startTestApp(TypedModule);
    await app.listen(0);
    const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    const json = { 'content-type': 'application/json' };
    const answer = async (r: Response): Promise<[number, unknown]> => [r.status, await r.json()];
    try {
      for (const [sent, body] of REFUSED) {
        const r = await fetch(`${base}/typed`, { method: 'POST', headers: json, body: JSON.stringify(sent) });
        assert.deepEqual(await answer(r), [400, body], JSON.stringify(sent));
      }
      // a number without a fraction is a whole number, a whole number is a number, a date is a text
      const r = await fetch(`${base}/typed`, { method: 'POST', headers: json, body: '{"count": 3.0, "price": 5, "on": true, "at": "2026-03-04T05:06:07.089Z", "sizes": [2.0]}' });
      assert.equal(r.status, 201);
      const made = (await r.json()) as Record<string, unknown>;
      assert.deepEqual([made.count, made.price, made.on, made.at, made.sizes], [3, 5, true, '2026-03-04T05:06:07.089Z', [2]]);
      // a parameter of the query has no JSON type: it converts from its text
      assert.equal(((await (await fetch(`${base}/typed/built?name=ok&count=4`)).json()) as { count: number }).count, 4);

      // a model built in code
      assert.throws(() => new Typed({ name: 'x' }), (e: unknown) => e instanceof InvalidModel && e.message === 'Typed is not valid: name must have at least 2 characters');
      assert.equal(new Typed({ name: 'ok' }).count, 1);
      assert.deepEqual(await answer(await fetch(`${base}/typed/built?name=x`)), [500, { status: 500, message: 'error' }]);
      assert.equal(((await (await fetch(`${base}/typed/built?name=ok`)).json()) as { name: string }).name, 'ok');
    } finally {
      await stopTestApp(app);
    }
  });
});
