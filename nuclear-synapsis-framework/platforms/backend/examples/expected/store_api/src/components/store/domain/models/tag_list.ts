import { IsArray, IsString } from 'class-validator';

/** The labels an order is tagged with. */
export class TagList {
  @IsString({ each: true })
  @IsArray()
  labels!: string[];

  constructor(values: Partial<TagList> = {}) {
    Object.assign(this, values);
  }
}
