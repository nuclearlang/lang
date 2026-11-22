import { IsString } from 'class-validator';
import { checkModel } from 'synapsis-nest';

/** A public holiday, as the holidays API answers it. */
export class Holiday {
  @IsString()
  date!: string;
  @IsString()
  name!: string;

  constructor(values?: Partial<Holiday>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
