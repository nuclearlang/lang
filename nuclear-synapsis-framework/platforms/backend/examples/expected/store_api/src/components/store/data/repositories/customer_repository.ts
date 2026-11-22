import { Customer } from '../entities/customer.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppError, Page, Repository, Result, gte, ilike } from 'synapsis-nest';

/** The customers of the database: find, findAll, save and remove come with it. */
@Injectable()
export class CustomerRepository extends Repository<Customer> {
  constructor(@InjectModel(Customer) model: typeof Customer) {
    super(model);
  }

  page(page: number, size: number = 20): Promise<Page<Customer>> {
    const q = this.query();
    q.orderBy('id');
    return q.paginate(page, size);
  }

  byEmail(email: string): Promise<Result<AppError, Customer>> {
    const q = this.query();
    q.where({ 'email': email });
    return q.getOne();
  }

  /** the customers whose name has the text, in any case, by name */
  search(text: string, page: number = 1, size: number = 20): Promise<Page<Customer>> {
    const q = this.query();
    q.where({ 'name': ilike(`%${text}%`) });
    q.orderBy('name');
    q.orderBy('id');
    return q.paginate(page, size);
  }

  /** the vip customers with at least that credit, the richest first */
  vips(credit: number = 0.0): Promise<Customer[]> {
    const q = this.query();
    q.where({ 'vip': true, 'credit': gte(credit) });
    q.orderBy('credit', { desc: true });
    q.orderBy('id');
    return q.getMany();
  }

  withOrders(id: number): Promise<Result<AppError, Customer>> {
    const q = this.query();
    q.where({ 'id': id });
    q.relations('orders.tags');
    return q.getOne();
  }
}
