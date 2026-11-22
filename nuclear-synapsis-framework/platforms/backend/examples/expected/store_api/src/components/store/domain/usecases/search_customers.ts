import { Customer } from '../../data/entities/customer.js';
import { CustomerRepository } from '../../data/repositories/customer_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Page, Result } from 'synapsis-nest';

/** What CustomerRepository.search answers, for the rest of store. */
@Injectable()
export class SearchCustomers {
  constructor(private readonly repository: CustomerRepository) {}

  async exec(text: string, page: number, size: number): Promise<Result<AppError, Page<Customer>>> {
    return Ok(await this.repository.search(text, page, size));
  }
}
