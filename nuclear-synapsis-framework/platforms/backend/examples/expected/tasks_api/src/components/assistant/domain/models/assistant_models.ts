import { IsArray, IsString, MinLength } from 'class-validator';
import { IsWhole, checkModel } from 'synapsis-nest';

/** A message for the assistant; `thread` keeps one conversation. */
export class ChatRequest {
  @IsString()
  @MinLength(1)
  message!: string;
  @IsString()
  thread: string = 'default';

  constructor(values?: Partial<ChatRequest>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}

export class ChatReply {
  @IsString()
  answer!: string;

  constructor(values?: Partial<ChatReply>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}

/** A goal for the planner. */
export class PlanRequest {
  @IsString()
  @MinLength(1)
  goal!: string;

  constructor(values?: Partial<PlanRequest>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}

export class PlanReply {
  @IsString({ each: true })
  @IsArray()
  titles!: string[];
  @IsWhole()
  created!: number;
  @IsString({ each: true })
  @IsArray()
  failed!: string[];

  constructor(values?: Partial<PlanReply>) {
    if (values) {
      Object.assign(this, values);
      checkModel(this);
    }
  }
}
