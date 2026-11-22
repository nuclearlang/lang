import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Page, Result } from 'synapsis-nest';

/** What CustomerRepository.page answers, for the rest of store. */
@Injectable()
export class PageCustomers {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(page: number, size: number): Promise<Result<AppError, Page<Customer>>> {
    return Ok(await this.repository.page(page, size));
  }
}
