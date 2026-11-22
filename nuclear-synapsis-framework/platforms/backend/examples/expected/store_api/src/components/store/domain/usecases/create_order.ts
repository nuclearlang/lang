import { Order } from '../../data/entities/order.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { NewOrder } from '../models/new_order.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Ok, Result } from 'synapsis-nest';

/** Adds an order of a customer; NotFound (404) when there is no such customer. */
@Injectable()
export class CreateOrder {
  constructor(
    private readonly repository: OrderRepository,
    private readonly customers: CustomerRepository,
  ) {}

  async exec(input: NewOrder): Promise<Result<AppError, Order>> {
    const customerResult = await this.customers.find(input.customerId);
    if (customerResult.isErr) return Err(customerResult.error);
    const customer = customerResult.value;
    return Ok(await this.repository.save(
      new Order({
        customerId: customer.id,
        quantity: input.quantity,
        total: input.total,
        note: input.note,
        status: input.status,
        paid: input.paid,
        placedAt: input.placedAt,
      }),
    ));
  }
}
