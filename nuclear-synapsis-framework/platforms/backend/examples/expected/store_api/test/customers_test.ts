import { AppModule } from '../src/app.module.js';
import { NewCustomer } from '../src/components/store/domain/models/new_customer.js';
import { StoreAppComponent } from '../src/components/store/store_appcomponent.js';
import { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { inject } from 'synapsis-nest';
import { startTestApp, stopTestApp } from 'synapsis-nest/testing';

import assert from 'node:assert/strict';

/** The tests of customers: the database is in memory and empty in each test. */
describe('CustomersTest', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await startTestApp(AppModule);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('adds a customer and finds it', async () => {
    const app = inject(StoreAppComponent);
    const made = await app.createCustomer(
      new NewCustomer({
        email: 'ana@example.com',
        name: 'name',
        nickname: 'nickname',
        vip: true,
        credit: 1.5,
      }),
    );
    assert.ok(made.isOk);
    const found = await app.getCustomer(made.value.id);
    assert.ok(found.isOk);
  });

  it('a missing customer is not found', async () => {
    const app = inject(StoreAppComponent);
    const found = await app.getCustomer(999);
    assert.ok(found.error.status === 404);
  });
});
