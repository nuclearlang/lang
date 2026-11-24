import { Balance } from '../../data/entities/balance.js';
import { BalanceRepository } from '../../data/repositories/balance_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';

/** One balance by its id; NotFound (404) when there is none. */
@Injectable()
export class GetBalance {
  constructor(private readonly repository: BalanceRepository) {}

  async exec(id: number): Promise<Result<AppError, Balance>> {
    return await this.repository.find(id);
  }
}
