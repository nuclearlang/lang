import { Json } from 'synapsis-web';

/** What failed with todos: Synapsis builds it with the failure's message. */
export class TodoError {
  readonly message: string;

  constructor(init: { message: string }) {
    this.message = init.message;
  }

  static fromJson(json: Json): TodoError {
    return new TodoError({
      message: json['message'] as string,
    });
  }

  toJson(): Json {
    return {
      message: this.message,
    };
  }

  /** The same value with some fields changed. */
  copyWith(changes: Partial<{ message: string }>): TodoError {
    return new TodoError({ ...this, ...changes });
  }
}
