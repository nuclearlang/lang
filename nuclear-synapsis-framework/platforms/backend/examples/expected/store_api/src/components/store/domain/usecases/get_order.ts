import { Order } from '../../data/entities/order.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';

/** One order by its id; NotFound (404) when there is none. */
@Injectable()
export class GetOrder {
  constructor(private readonly repository: OrderRepository) {}

  async exec(id: number): Promise<Result<AppError, Order>> {
    return await this.repository.find(id);
  }
}
