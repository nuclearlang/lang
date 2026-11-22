import { Order } from '../../data/entities/order.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** What OrderRepository.unnoted answers, for the rest of store. */
@Injectable()
export class UnnotedOrders {
  constructor(private readonly repository: OrderRepository) {}

  async exec(): Promise<Result<AppError, Order[]>> {
    return Ok(await this.repository.unnoted());
  }
}
