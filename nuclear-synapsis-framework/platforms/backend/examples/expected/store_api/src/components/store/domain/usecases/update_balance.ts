import { Balance } from '../../data/entities/balance.js';
import { BalanceRepository } from '../../data/repositories/balance_repository.js';
import { NewBalance } from '../models/new_balance.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Ok, Result } from 'synapsis-nest';

/** Changes a balance; NotFound (404) when there is none. */
@Injectable()
export class UpdateBalance {
  constructor(private readonly repository: BalanceRepository) {}

  async exec(id: number, input: NewBalance): Promise<Result<AppError, Balance>> {
    const foundResult = await this.repository.find(id);
    if (foundResult.isErr) return Err(foundResult.error);
    const found = foundResult.value;
    found.serial = input.serial;
    found.amount = input.amount;
    found.rate = input.rate;
    return Ok(await this.repository.save(found));
  }
}
