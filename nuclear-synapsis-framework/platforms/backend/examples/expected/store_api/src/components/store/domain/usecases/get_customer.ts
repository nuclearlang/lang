import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';

/** One customer by its id; NotFound (404) when there is none. */
@Injectable()
export class GetCustomer {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(id: number): Promise<Result<AppError, Customer>> {
    return await this.repository.find(id);
  }
}
