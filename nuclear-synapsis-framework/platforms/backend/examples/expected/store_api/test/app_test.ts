import { AppModule } from '../src/app.module.js';
import { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { startTestApp, stopTestApp } from 'synapsis-nest/testing';

import assert from 'node:assert/strict';

/**
 * The first test (nuclear help backend, §2.13): every test runs with the connections open and the databases in
 * memory; inject<X>() gives the app's instances, expect(condition) asserts.
 */
describe('App', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await startTestApp(AppModule);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('the app starts with its connections', async () => {
    assert.ok(true);
  });
});
