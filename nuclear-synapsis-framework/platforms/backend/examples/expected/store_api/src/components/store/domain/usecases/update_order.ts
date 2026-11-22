import { Order } from '../../data/entities/order.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { NewOrder } from '../models/new_order.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Ok, Result } from 'synapsis-nest';

/** Changes a order; NotFound (404) when there is none. */
@Injectable()
export class UpdateOrder {
  constructor(private readonly repository: OrderRepository) {}

  async exec(id: number, input: NewOrder): Promise<Result<AppError, Order>> {
    const foundResult = await this.repository.find(id);
    if (foundResult.isErr) return Err(foundResult.error);
    const found = foundResult.value;
    found.customerId = input.customerId;
    found.quantity = input.quantity;
    found.total = input.total;
    found.note = input.note;
    found.status = input.status;
    found.paid = input.paid;
    found.placedAt = input.placedAt;
    return Ok(await this.repository.save(found));
  }
}
