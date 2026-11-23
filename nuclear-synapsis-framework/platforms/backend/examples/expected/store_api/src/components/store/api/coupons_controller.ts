import { Coupon } from '../data/entities/coupon.js';
import { NewCoupons } from '../domain/models/new_coupons.js';
import { StoreAppComponent } from '../store_appcomponent.js';
import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { AppError, IntPipe, RequiredPipe, Result } from 'synapsis-nest';

/** The routes of coupons. */
@Controller('coupons')
export class CouponsController {
  constructor(private readonly app: StoreAppComponent) {}

  @Post()
  async give(@Body() input: NewCoupons): Promise<Result<AppError, Coupon[]>> {
    return await this.app.giveCoupons(input);
  }

  @Put(':id/clear')
  async clear(@Param('id', RequiredPipe, IntPipe) id: number): Promise<Result<AppError, number>> {
    return await this.app.clearCoupon(id);
  }
}
