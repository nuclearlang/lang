import { Coupon } from '../entities/coupon.js';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Repository } from 'synapsis-nest';

/** The coupons of the database: find, findAll, save and remove come with it. */
@Injectable()
export class CouponRepository extends Repository<Coupon> {
  constructor(@InjectModel(Coupon) model: typeof Coupon) {
    super(model);
  }

  /** takes the code of a coupon away: how many rows changed */
  clearCode(id: number): Promise<number> {
    const q = this.query();
    q.where({ 'id': id });
    return q.update({ 'code': null });
  }
}
