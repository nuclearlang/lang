import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { NewCustomer } from '../models/new_customer.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Ok, Result } from 'synapsis-nest';

/** Changes a customer; NotFound (404) when there is none. */
@Injectable()
export class UpdateCustomer {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(id: number, input: NewCustomer): Promise<Result<AppError, Customer>> {
    const foundResult = await this.repository.find(id);
    if (foundResult.isErr) return Err(foundResult.error);
    const found = foundResult.value;
    found.email = input.email;
    found.name = input.name;
    found.nickname = input.nickname;
    found.vip = input.vip;
    found.credit = input.credit;
    return Ok(await this.repository.save(found));
  }
}
