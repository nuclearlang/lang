import { AppModule } from '../src/app.module.js';
import { Customer } from '../src/components/store/data/entities/customer.js';
import { Order } from '../src/components/store/data/entities/order.js';
import { CustomerRepository } from '../src/components/store/data/repositories/customer_repository.js';
import { OrderRepository } from '../src/components/store/data/repositories/order_repository.js';
import { NewCustomer } from '../src/components/store/domain/models/new_customer.js';
import { NewOrder } from '../src/components/store/domain/models/new_order.js';
import { TagList } from '../src/components/store/domain/models/tag_list.js';
import { StoreAppComponent } from '../src/components/store/store_appcomponent.js';
import { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { inject } from 'synapsis-nest';
import { startTestApp, stopTestApp } from 'synapsis-nest/testing';

import assert from 'node:assert/strict';

/**
 * The tests of the store's own rules: the unique email, the pages, the searches, the relations and the
 * transactions. The database is in memory and empty in each test.
 */
describe('StoreTest', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await startTestApp(AppModule);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('a repeated email is a conflict', async () => {
    const app = inject(StoreAppComponent);
    await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana' }));
    const again = await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Another Ana' }));
    assert.ok(again.error.status === 409);
  });

  it('the defaults of a customer and what the database fills', async () => {
    const app = inject(StoreAppComponent);
    const made = (await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana' }))).value;
    const found = (await app.getCustomer(made.id)).value;
    assert.ok(found.id > 0);
    assert.ok(!found.vip);
    assert.ok(found.credit === 0.0);
    assert.ok(found.nickname == null);
    assert.ok(found.createdAt != null);
    assert.ok(found.updatedAt != null);
  });

  it('the customers come in pages', async () => {
    const app = inject(StoreAppComponent);
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      await app.createCustomer(new NewCustomer({ email: `${name}@example.com`, name: name }));
    }
    const second = (await app.pageCustomers(2, 2)).value;
    const items: Customer[] = second.items;
    assert.ok(items.length === 2);
    assert.ok(items[0].name === 'c');
    assert.ok(second.page === 2);
    assert.ok(second.total === 5);
    assert.ok(second.pages === 3);
    const last = (await app.pageCustomers(3, 2)).value;
    const rest: Customer[] = last.items;
    assert.ok(rest.length === 1);
  });

  it('a search ignores the case and sorts by name', async () => {
    const app = inject(StoreAppComponent);
    await app.createCustomer(new NewCustomer({ email: 'z@example.com', name: 'maria zeta' }));
    await app.createCustomer(new NewCustomer({ email: 'a@example.com', name: 'Maria alfa' }));
    await app.createCustomer(new NewCustomer({ email: 'l@example.com', name: 'luis' }));
    const found = (await app.searchCustomers('MARIA', 1, 10)).value;
    const items: Customer[] = found.items;
    assert.ok(found.total === 2);
    assert.ok(items[0].email === 'a@example.com');
  });

  it('the queries of the repository: operators, order and update', async () => {
    const customers = inject(CustomerRepository);
    const orders = inject(OrderRepository);
    const ana = await customers.save(new Customer({ email: 'ana@example.com', name: 'Ana', vip: true, credit: 500.0 }));
    await customers.save(new Customer({ email: 'luis@example.com', name: 'Luis', vip: true, credit: 50.0 }));
    await customers.save(new Customer({ email: 'eva@example.com', name: 'Eva', credit: 900.0 }));
    const vips = await customers.vips(100.0);
    assert.ok(vips.length === 1);
    assert.ok(vips[0].email === 'ana@example.com');
    assert.ok((await customers.byEmail('eva@example.com')).isOk);
    assert.ok((await customers.byEmail('nobody@example.com')).error.status === 404);
    await orders.save(new Order({ customerId: ana.id, total: 10.0, note: 'first' }));
    await orders.save(new Order({ customerId: ana.id, total: 30.0 }));
    await orders.save(new Order({ customerId: ana.id, total: 20.0, note: '' }));
    const large = await orders.ofCustomer(ana.id, 15.0);
    assert.ok(large.length === 2);
    assert.ok(large[0].total === 30.0);
    const unnoted = await orders.unnoted();
    assert.ok(unnoted.length === 1);
    assert.ok(await orders.markPaid(ana.id) === 3);
    assert.ok(await orders.markPaid(ana.id) === 0);
    assert.ok(await orders.paidCount() === 3);
  });

  it('a customer has its orders and an order its customer and its tags', async () => {
    const app = inject(StoreAppComponent);
    const ana = (await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana' }))).value;
    const order = (await app.createOrder(new NewOrder({ customerId: ana.id, total: 5.0 }))).value;
    await app.createOrder(new NewOrder({ customerId: ana.id, total: 6.0 }));
    const tagged = (await app.tagOrder(order.id, new TagList({ labels: ['gift', 'urgent'] }))).value;
    assert.ok(tagged.tags!.length === 2);
    assert.ok(tagged.customer!.email === 'ana@example.com');
    const again = (await app.tagOrder(order.id, new TagList({ labels: ['gift'] }))).value;
    assert.ok(again.tags!.length === 1);
    assert.ok((await app.listTags(1)).value.length === 2);
    const loaded = (await app.customerOrders(ana.id)).value;
    assert.ok(loaded.orders!.length === 2);
  });

  it('removing a customer removes its orders', async () => {
    const app = inject(StoreAppComponent);
    const orders = inject(OrderRepository);
    const ana = (await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana' }))).value;
    await app.createOrder(new NewOrder({ customerId: ana.id, total: 5.0 }));
    assert.ok(await orders.count() === 1);
    assert.ok((await app.deleteCustomer(ana.id)).isOk);
    assert.ok(await orders.count() === 0);
  });

  it('a checkout takes the credit; without enough credit nothing is written', async () => {
    const app = inject(StoreAppComponent);
    const orders = inject(OrderRepository);
    const ana = (await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana', credit: 100.0 }))).value;
    const bought = await app.checkout(new NewOrder({ customerId: ana.id, total: 60.0 }));
    assert.ok(bought.isOk);
    assert.ok((await app.getCustomer(ana.id)).value.credit === 40.0);
    const refused = await app.checkout(new NewOrder({ customerId: ana.id, total: 60.0 }));
    assert.ok(refused.error.status === 409);
    assert.ok(await orders.count() === 1);
    assert.ok((await app.getCustomer(ana.id)).value.credit === 40.0);
  });

  it('paying too many orders at once pays none', async () => {
    const app = inject(StoreAppComponent);
    const orders = inject(OrderRepository);
    const ana = (await app.createCustomer(new NewCustomer({ email: 'ana@example.com', name: 'Ana' }))).value;
    await app.createOrder(new NewOrder({ customerId: ana.id, total: 5.0 }));
    assert.ok((await app.payOrders(ana.id)).value.count === 1);
    for (const total of [1.0, 2.0, 3.0]) {
      await app.createOrder(new NewOrder({ customerId: ana.id, total: total }));
    }
    assert.ok((await app.payOrders(ana.id)).error.status === 409);
    assert.ok(await orders.paidCount() === 1);
    assert.ok((await app.payOrders(999)).error.status === 404);
  });
});
