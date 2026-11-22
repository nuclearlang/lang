import { IsArray, IsInt, IsString, MinLength } from 'class-validator';

/** A message for the assistant; `thread` keeps one conversation. */
export class ChatRequest {
  @IsString()
  @MinLength(1)
  message!: string;
  @IsString()
  thread: string = 'default';

  constructor(values: Partial<ChatRequest> = {}) {
    Object.assign(this, values);
  }
}

export class ChatReply {
  @IsString()
  answer!: string;

  constructor(values: Partial<ChatReply> = {}) {
    Object.assign(this, values);
  }
}

/** A goal for the planner. */
export class PlanRequest {
  @IsString()
  @MinLength(1)
  goal!: string;

  constructor(values: Partial<PlanRequest> = {}) {
    Object.assign(this, values);
  }
}

export class PlanReply {
  @IsString({ each: true })
  @IsArray()
  titles!: string[];
  @IsInt()
  created!: number;
  @IsString({ each: true })
  @IsArray()
  failed!: string[];

  constructor(values: Partial<PlanReply> = {}) {
    Object.assign(this, values);
  }
}
