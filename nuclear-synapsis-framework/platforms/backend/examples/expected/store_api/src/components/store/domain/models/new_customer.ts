import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { checkModel } from 'synapsis-nest';

/** What it takes to add or change a customer. */
export class NewCustomer {
  @IsString()
  @IsEmail()
  email!: string;
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nickname?: string;
  @IsBoolean()
  vip: boolean = false;
  @IsNumber()
  @Min(0)
  credit: number = 0.0;

  constructor(values?: Partial<NewCustomer>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
