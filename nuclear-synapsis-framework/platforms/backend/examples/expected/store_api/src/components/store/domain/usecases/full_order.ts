import { Order } from '../../data/entities/order.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';

/** What OrderRepository.full answers, for the rest of store. */
@Injectable()
export class FullOrder {
  constructor(private readonly repository: OrderRepository) {}

  async exec(id: number): Promise<Result<AppError, Order>> {
    return await this.repository.full(id);
  }
}
