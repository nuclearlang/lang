import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** One page of customers. */
@Injectable()
export class ListCustomers {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(page: number): Promise<Result<AppError, Customer[]>> {
    const found = await this.repository.page(page, 20);
    return Ok(found.items);
  }
}
