import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

/** What it takes to add or change an order. */
export class NewOrder {
  @IsInt()
  customerId!: number;
  @IsInt()
  quantity: number = 1;
  @IsNumber()
  total!: number;
  @IsOptional()
  @IsString()
  note?: string;
  @IsString()
  @MaxLength(20)
  status: string = 'pending';
  @IsBoolean()
  paid: boolean = false;
  @IsOptional()
  placedAt?: Date;

  constructor(values: Partial<NewOrder> = {}) {
    Object.assign(this, values);
  }
}
