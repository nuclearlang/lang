import { AppModule } from '../src/app.module.js';
import { NewCustomer } from '../src/components/store/domain/models/new_customer.js';
import { NewOrder } from '../src/components/store/domain/models/new_order.js';
import { StoreAppComponent } from '../src/components/store/store_appcomponent.js';
import { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { inject } from 'synapsis-nest';
import { startTestApp, stopTestApp } from 'synapsis-nest/testing';

import assert from 'node:assert/strict';

/** The tests of orders: the database is in memory and empty in each test. */
describe('OrdersTest', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await startTestApp(AppModule);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('adds an order and finds it', async () => {
    const app = inject(StoreAppComponent);
    const customer = (await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana' }))).value;
    const made = await app.createOrder(
      new NewOrder({
        customerId: customer.id,
        quantity: 2,
        total: 1.5,
        note: 'note',
        placedAt: new Date(Date.UTC(2026, 3 - 1, 4, 5, 6, 7)),
      }),
    );
    assert.ok(made.isOk);
    const found = await app.getOrder(made.value.id);
    assert.ok(found.isOk);
    assert.ok(found.value.quantity === 2);
    assert.ok(found.value.total === 1.5);
    assert.ok(found.value.status === 'pending');
    assert.ok(!found.value.paid);
    assert.ok(found.value.placedAt!.getTime() === new Date(Date.UTC(2026, 3 - 1, 4, 5, 6, 7)).getTime());
  });

  it('a missing order is not found', async () => {
    const app = inject(StoreAppComponent);
    const found = await app.getOrder(999);
    assert.ok(found.error.status === 404);
  });

  it('an order of a missing customer is not found', async () => {
    const app = inject(StoreAppComponent);
    const made = await app.createOrder(new NewOrder({ customerId: 999, total: 1.0 }));
    assert.ok(made.error.status === 404);
  });
});
