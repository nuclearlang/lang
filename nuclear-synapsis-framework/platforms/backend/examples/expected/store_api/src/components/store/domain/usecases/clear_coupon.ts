import { CouponRepository } from '../../data/repositories/coupon_repository.js';
import { Injectable } from '@nestjs/common';
import { AppError, Ok, Result } from 'synapsis-nest';

/** Takes the code of a coupon away. The column is required: the database refuses it (409). */
@Injectable()
export class ClearCoupon {
  constructor(private readonly repository: CouponRepository) {}

  async exec(id: number): Promise<Result<AppError, number>> {
    return Ok(await this.repository.clearCode(id));
  }
}
