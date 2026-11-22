import { IsString } from 'class-validator';

/** What it takes to add or change a tag. */
export class NewTag {
  @IsString()
  label!: string;

  constructor(values: Partial<NewTag> = {}) {
    Object.assign(this, values);
  }
}
