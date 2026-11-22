import { Order } from '../../data/entities/order.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** One page of orders. */
@Injectable()
export class ListOrders {
  constructor(private readonly repository: OrderRepository) {}

  async exec(page: number): Promise<Result<AppError, Order[]>> {
    const found = await this.repository.page(page, 20);
    return Ok(found.items);
  }
}
