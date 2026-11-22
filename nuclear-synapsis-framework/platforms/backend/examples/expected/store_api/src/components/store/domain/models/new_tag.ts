import { IsString } from 'class-validator';
import { checkModel } from 'synapsis-nest';

/** What it takes to add or change a tag. */
export class NewTag {
  @IsString()
  label!: string;

  constructor(values?: Partial<NewTag>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
