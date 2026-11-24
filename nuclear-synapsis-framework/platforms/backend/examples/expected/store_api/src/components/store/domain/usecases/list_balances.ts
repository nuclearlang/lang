import { Balance } from '../../data/entities/balance.js';
import { BalanceRepository } from '../../data/repositories/balance_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** One page of balances. */
@Injectable()
export class ListBalances {
  constructor(private readonly repository: BalanceRepository) {}

  async exec(page: number): Promise<Result<AppError, Balance[]>> {
    const found = await this.repository.page(page, 20);
    return Ok(found.items);
  }
}
