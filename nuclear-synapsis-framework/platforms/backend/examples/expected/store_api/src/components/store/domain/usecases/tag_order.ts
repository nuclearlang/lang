import { Order } from '../../data/entities/order.js';
import { Tag } from '../../data/entities/tag.js';
import { OrderRepository } from '../../data/repositories/order_repository.js';
import { TagRepository } from '../../data/repositories/tag_repository.js';
import { TagList } from '../models/tag_list.js';
import { Injectable } from '@nestjs/common';
import { AppError, Err, Result, transactional } from 'synapsis-nest';

/** Sets the tags of an order by their labels, adding the tags that do not exist, in one transaction. */
@Injectable()
export class TagOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly tags: TagRepository,
  ) {}

  @transactional
  async exec(id: number, input: TagList): Promise<Result<AppError, Order>> {
    const orderResult = await this.orders.find(id);
    if (orderResult.isErr) return Err(orderResult.error);
    const order = orderResult.value;
    const found: Tag[] = [];
    for (const label of input.labels) {
      const known = await this.tags.where({ 'label': label }).exists();
      if (!known) {
        await this.tags.save(new Tag({ label: label }));
      }
      const tagResult = await this.tags.byLabel(label);
      if (tagResult.isErr) return Err(tagResult.error);
      const tag = tagResult.value;
      found.push(tag);
    }
    order.tags = found;
    await this.orders.save(order);
    return await this.orders.full(id);
  }
}
