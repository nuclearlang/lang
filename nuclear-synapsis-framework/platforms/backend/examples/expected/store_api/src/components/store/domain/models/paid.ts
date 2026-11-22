import { IsInt } from 'class-validator';
import { checkModel } from 'synapsis-nest';

/** How many orders were paid. */
export class Paid {
  @IsInt()
  count!: number;

  constructor(values?: Partial<Paid>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
