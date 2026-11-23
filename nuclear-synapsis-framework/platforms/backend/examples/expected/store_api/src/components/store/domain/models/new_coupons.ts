import { IsArray, IsString } from 'class-validator';
import { IsWhole, checkModel } from 'synapsis-nest';

/** The coupons a customer is given at once, by their codes. */
export class NewCoupons {
  @IsWhole()
  customerId!: number;
  @IsString({ each: true })
  @IsArray()
  codes!: string[];

  constructor(values?: Partial<NewCoupons>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
