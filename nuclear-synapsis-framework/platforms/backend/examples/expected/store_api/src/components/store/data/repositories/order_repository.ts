import { Order } from '../entities/order.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppError, Page, Repository, Result, gte, isNull } from 'synapsis-nest';

/** The orders of the database: find, findAll, save and remove come with it. */
@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(@InjectModel(Order) model: typeof Order) {
    super(model);
  }

  page(page: number, size: number = 20): Promise<Page<Order>> {
    const q = this.query();
    q.orderBy('id');
    return q.paginate(page, size);
  }

  /** the order with its customer and its tags */
  full(id: number): Promise<Result<AppError, Order>> {
    const q = this.query();
    q.where({ 'id': id });
    q.relations('customer', 'tags');
    return q.getOne();
  }

  /** the orders of a customer of at least that total, the largest first */
  ofCustomer(customerId: number, minTotal: number = 0.0): Promise<Order[]> {
    const q = this.query();
    q.where({ 'customerId': customerId, 'total': gte(minTotal) });
    q.orderBy('total', { desc: true });
    q.orderBy('id');
    return q.getMany();
  }

  unnoted(): Promise<Order[]> {
    const q = this.query();
    q.where({ 'note': isNull() });
    q.orderBy('id');
    return q.getMany();
  }

  /** marks the unpaid orders of a customer as paid: how many */
  markPaid(customerId: number): Promise<number> {
    const q = this.query();
    q.where({ 'customerId': customerId, 'paid': false });
    return q.update({ 'paid': true, 'status': 'paid' });
  }

  paidCount(): Promise<number> {
    const q = this.query();
    q.where({ 'paid': true });
    return q.count();
  }
}
