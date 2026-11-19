import { Json } from 'synapsis-web';

/** What failed with tasks: Synapsis builds it with the failure's message. */
export class TaskError {
  readonly message: string;

  constructor(init: { message: string }) {
    this.message = init.message;
  }

  static fromJson(json: Json): TaskError {
    return new TaskError({
      message: json['message'] as string,
    });
  }

  toJson(): Json {
    return {
      message: this.message,
    };
  }

  /** The same value with some fields changed. */
  copyWith(changes: Partial<{ message: string }>): TaskError {
    return new TaskError({ ...this, ...changes });
  }
}
