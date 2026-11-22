import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** What CustomerRepository.vips answers, for the rest of store. */
@Injectable()
export class VipCustomers {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(credit: number): Promise<Result<AppError, Customer[]>> {
    return Ok(await this.repository.vips(credit));
  }
}
