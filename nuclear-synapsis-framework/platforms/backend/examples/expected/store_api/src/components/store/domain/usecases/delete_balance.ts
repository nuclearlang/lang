import { BalanceRepository } from '../../data/repositories/balance_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Ok, Result } from 'synapsis-nest';

/** Removes a balance; NotFound (404) when there is none. */
@Injectable()
export class DeleteBalance {
  constructor(private readonly repository: BalanceRepository) {}

  async exec(id: number): Promise<Result<AppError, boolean>> {
    const foundResult = await this.repository.find(id);
    if (foundResult.isErr) return Err(foundResult.error);
    const found = foundResult.value;
    await this.repository.remove(found.id);
    return Ok(true);
  }
}
