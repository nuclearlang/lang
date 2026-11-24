import { Balance } from '../../data/entities/balance.js';
import { BalanceRepository } from '../../data/repositories/balance_repository.js';
import { NewBalance } from '../models/new_balance.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** Adds a balance. */
@Injectable()
export class CreateBalance {
  constructor(private readonly repository: BalanceRepository) {}

  async exec(input: NewBalance): Promise<Result<AppError, Balance>> {
    return Ok(await this.repository.save(new Balance({ serial: input.serial, amount: input.amount, rate: input.rate })));
  }
}
