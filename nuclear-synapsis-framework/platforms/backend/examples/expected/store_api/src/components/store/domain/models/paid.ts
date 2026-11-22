import { IsInt } from 'class-validator';

/** How many orders were paid. */
export class Paid {
  @IsInt()
  count!: number;

  constructor(values: Partial<Paid> = {}) {
    Object.assign(this, values);
  }
}
