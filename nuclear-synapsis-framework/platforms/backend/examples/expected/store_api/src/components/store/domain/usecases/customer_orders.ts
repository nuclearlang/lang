import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';

/** What CustomerRepository.withOrders answers, for the rest of store. */
@Injectable()
export class CustomerOrders {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(id: number): Promise<Result<AppError, Customer>> {
    return await this.repository.withOrders(id);
  }
}
