import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Paid } from '../models/paid.js';
import { Injectable } from '@nestjs/common';
import { AppError, Conflict, Err, Ok, Result, transactional } from 'synapsis-nest';

/**
 * Marks every unpaid order of a customer as paid, in one transaction. NotFound (404) when there is no such
 * customer; Conflict (409) when a customer who is not vip pays more than two at once: none is paid then.
 */
@Injectable()
export class PayOrders {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: OrderRepository,
  ) {}

  @transactional
  async exec(customerId: number): Promise<Result<AppError, Paid>> {
    const customerResult = await this.customers.find(customerId);
    if (customerResult.isErr) return Err(customerResult.error);
    const customer = customerResult.value;
    const count = await this.orders.markPaid(customerId);
    // checked after the orders changed, on purpose: the Err takes the change back
    if (count > 2 && !customer.vip) {
      return Err(new Conflict(`customer ${customer.id} pays at most two orders at once`));
    }
    return Ok(new Paid({ count: count }));
  }
}
