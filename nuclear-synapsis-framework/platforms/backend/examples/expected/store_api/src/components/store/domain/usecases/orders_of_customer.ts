import { Order } from '../../data/entities/order.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** What OrderRepository.ofCustomer answers, for the rest of store. */
@Injectable()
export class OrdersOfCustomer {
  constructor(private readonly repository: OrderRepository) {}

  async exec(customerId: number, minTotal: number): Promise<Result<AppError, Order[]>> {
    return Ok(await this.repository.ofCustomer(customerId, minTotal));
  }
}
