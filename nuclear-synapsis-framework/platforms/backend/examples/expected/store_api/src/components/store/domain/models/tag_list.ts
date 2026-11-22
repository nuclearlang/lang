import { IsArray, IsString } from 'class-validator';
import { checkModel } from 'synapsis-nest';

/** The labels an order is tagged with. */
export class TagList {
  @IsString({ each: true })
  @IsArray()
  labels!: string[];

  constructor(values?: Partial<TagList>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
