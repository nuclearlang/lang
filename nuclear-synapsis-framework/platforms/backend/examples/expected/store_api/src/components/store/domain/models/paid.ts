import { IsWhole, checkModel } from 'synapsis-nest';

/** How many orders were paid. */
export class Paid {
  @IsWhole()
  count!: number;

  constructor(values?: Partial<Paid>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
