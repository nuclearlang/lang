// Every error answers Nuclear's body, the same in every dialect (ADR-synapsis-0013). The same cases, with the same
// expected bodies, are in synapsis-py/tests/test_errors.py.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AppError, Err, IntPipe, NotFound, Ok, Result } from '../src/index.js';
import { startTestApp, stopTestApp } from '../src/testing.js';

class Signup {
  @IsString()
  @IsEmail()
  email!: string;
  @IsString()
  @MinLength(3)
  @MaxLength(5)
  name!: string;
  @IsInt()
  @Min(18)
  @Max(99)
  age!: number;
  @IsString()
  @Matches(/^[A-Z]+$/)
  code!: string;
  @IsOptional()
  @IsString()
  @IsUrl()
  site?: string;
}

@Controller('signups')
class SignupController {
  @Post()
  create(@Body() signup: Signup): Signup {
    return signup;
  }

  @Get(':id')
  one(@Param('id', IntPipe) id: number, @Query('page', IntPipe) page?: number): Result<AppError, number> {
    if (id > 1) return Err(new NotFound(`no signup ${id}`));
    return Ok(id * (page ?? 1));
  }

  @Get('boom/now')
  boom(): number {
    throw new Error('a secret the answer must not show');
  }
}

@Module({ controllers: [SignupController] })
class SignupModule {}

const GOOD = { email: 'a@b.co', name: 'Anna', age: 30, code: 'ABC' };

// [what is sent, the status, the body]: the same list as test_errors.py
const BODIES: [unknown, number, unknown][] = [
  [{}, 400, { status: 400, message: 'invalid', errors: [
    { field: 'age', rule: 'required', message: 'age is required' },
    { field: 'code', rule: 'required', message: 'code is required' },
    { field: 'email', rule: 'required', message: 'email is required' },
    { field: 'name', rule: 'required', message: 'name is required' },
  ] }],
  [{ ...GOOD, email: 'nope', name: 'Al', age: 7, code: 'abc', site: 'x' }, 400, { status: 400, message: 'invalid', errors: [
    { field: 'age', rule: 'min', message: 'age must be at least 18' },
    { field: 'code', rule: 'pattern', message: 'code does not match its pattern' },
    { field: 'email', rule: 'email', message: 'email must be an e-mail address' },
    { field: 'name', rule: 'minLength', message: 'name must have at least 3 characters' },
    { field: 'site', rule: 'url', message: 'site must be a URL' },
  ] }],
  [{ ...GOOD, name: 'Annabelle', age: 120 }, 400, { status: 400, message: 'invalid', errors: [
    { field: 'age', rule: 'max', message: 'age must be at most 99' },
    { field: 'name', rule: 'maxLength', message: 'name must have at most 5 characters' },
  ] }],
  [{ ...GOOD, name: 5, age: 'old', email: null }, 400, { status: 400, message: 'invalid', errors: [
    { field: 'age', rule: 'type', message: 'age must be a whole number' },
    { field: 'email', rule: 'required', message: 'email is required' },
    { field: 'name', rule: 'type', message: 'name must be a text' },
  ] }],
];

describe('the body of an error', () => {
  it("is Nuclear's for every error, and /openapi.json is the document written from the Nuclear", async () => {
    // the document the transpiler writes next to the app
    const dir = mkdtempSync(join(tmpdir(), 'synapsis-errors-'));
    mkdirSync(join(dir, '.nuclear'));
    writeFileSync(join(dir, '.nuclear', 'openapi.json'), JSON.stringify({ openapi: '3.1.0', info: { title: 'from nuclear' }, paths: {} }));
    const before = process.cwd();
    process.chdir(dir);
    const app = await startTestApp(SignupModule);
    await app.listen(0);
    const base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    const json = { 'content-type': 'application/json' };
    const answer = async (r: Response): Promise<[number, unknown]> => [r.status, await r.json()];
    try {
      assert.equal((await fetch(`${base}/signups`, { method: 'POST', headers: json, body: JSON.stringify(GOOD) })).status, 201);
      for (const [sent, status, body] of BODIES) {
        const r = await fetch(`${base}/signups`, { method: 'POST', headers: json, body: JSON.stringify(sent) });
        assert.deepEqual(await answer(r), [status, body]);
      }
      // a body that is not JSON
      assert.deepEqual(await answer(await fetch(`${base}/signups`, { method: 'POST', headers: json, body: '{nope' })), [
        400,
        { status: 400, message: 'invalid', errors: [{ field: '', rule: 'json', message: 'the body is not valid JSON' }] },
      ]);
      // a parameter of the route and one of the query
      assert.deepEqual(await answer(await fetch(`${base}/signups/abc`)), [
        400,
        { status: 400, message: 'invalid', errors: [{ field: 'id', rule: 'type', message: 'id must be a whole number' }] },
      ]);
      assert.deepEqual(await answer(await fetch(`${base}/signups/1?page=x`)), [
        400,
        { status: 400, message: 'invalid', errors: [{ field: 'page', rule: 'type', message: 'page must be a whole number' }] },
      ]);
      assert.equal(await (await fetch(`${base}/signups/1?page=3`)).json(), 3);
      // the error of a Result, a route that does not exist, what nothing handled
      assert.deepEqual(await answer(await fetch(`${base}/signups/9`)), [404, { status: 404, message: 'no signup 9' }]);
      assert.deepEqual(await answer(await fetch(`${base}/nowhere`)), [404, { status: 404, message: 'not found' }]);
      assert.deepEqual(await answer(await fetch(`${base}/signups/boom/now`)), [500, { status: 500, message: 'error' }]);
      // the API is described once, from the Nuclear
      assert.equal(((await (await fetch(`${base}/openapi.json`)).json()) as { info: { title: string } }).info.title, 'from nuclear');
      assert.equal(((await (await fetch(`${base}/.nuclear/openapi.json`)).json()) as { info: { title: string } }).info.title, 'from nuclear');
    } finally {
      await stopTestApp(app);
      process.chdir(before);
    }
  });
});
