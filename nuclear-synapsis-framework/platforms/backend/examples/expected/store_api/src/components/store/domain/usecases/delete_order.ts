import { OrderRepository } from '../../data/repositories/order_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Ok, Result } from 'synapsis-nest';

/** Removes a order; NotFound (404) when there is none. */
@Injectable()
export class DeleteOrder {
  constructor(private readonly repository: OrderRepository) {}

  async exec(id: number): Promise<Result<AppError, boolean>> {
    const foundResult = await this.repository.find(id);
    if (foundResult.isErr) return Err(foundResult.error);
    const found = foundResult.value;
    await this.repository.remove(found.id);
    return Ok(true);
  }
}
