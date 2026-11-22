import { Order } from '../../data/entities/order.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { NewOrder } from '../models/new_order.js';
import { Injectable } from '@nestjs/common';
import { AppError, Conflict, Err, Ok, Result, transactional } from 'synapsis-nest';

/**
 * Places an order and takes its total from the customer's credit, in one transaction: without enough credit it is
 * a Conflict (409) and the order is not kept.
 */
@Injectable()
export class Checkout {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: OrderRepository,
  ) {}

  @transactional
  async exec(input: NewOrder): Promise<Result<AppError, Order>> {
    const customerResult = await this.customers.find(input.customerId);
    if (customerResult.isErr) return Err(customerResult.error);
    const customer = customerResult.value;
    const order = await this.orders.save(
      new Order({
        customerId: customer.id,
        quantity: input.quantity,
        total: input.total,
        note: input.note,
        placedAt: input.placedAt,
      }),
    );
    // checked after the order is written, on purpose: the Err takes the order back
    if (customer.credit < input.total) {
      return Err(new Conflict(`customer ${customer.id} has not enough credit`));
    }
    customer.credit -= input.total;
    await this.customers.save(customer);
    return Ok(order);
  }
}
