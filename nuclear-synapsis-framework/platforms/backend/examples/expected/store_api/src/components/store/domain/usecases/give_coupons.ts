import { Coupon } from '../../data/entities/coupon.js';
import { CouponRepository } from '../../data/repositories/coupon_repository.js';
import { NewCoupons } from '../models/new_coupons.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result, transactional } from 'synapsis-nest';

/**
 * Gives a customer several coupons in one transaction: all of them or none. Nothing is checked here on purpose: a
 * repeated code, a customer that does not exist and a code longer than its column are refused by the database (409).
 */
@Injectable()
export class GiveCoupons {
  constructor(private readonly repository: CouponRepository) {}

  @transactional
  async exec(input: NewCoupons): Promise<Result<AppError, Coupon[]>> {
    const given: Coupon[] = [];
    for (const code of input.codes) {
      const coupon = await this.repository.save(new Coupon({ customerId: input.customerId, code: code }));
      given.push(coupon);
    }
    return Ok(given);
  }
}
