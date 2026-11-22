import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { NewCustomer } from '../models/new_customer.js';
import { Injectable } from '@nestjs/common';
import { AppError, Conflict, Err, Ok, Result } from 'synapsis-nest';

/** Adds a customer; Conflict (409) when the email is taken. */
@Injectable()
export class CreateCustomer {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(input: NewCustomer): Promise<Result<AppError, Customer>> {
    const taken = await this.repository.where({ 'email': input.email }).exists();
    if (taken) {
      return Err(new Conflict(`there is already a customer '${input.email}'`));
    }
    return Ok(await this.repository.save(
      new Customer({
        email: input.email,
        name: input.name,
        nickname: input.nickname,
        vip: input.vip,
        credit: input.credit,
      }),
    ));
  }
}
