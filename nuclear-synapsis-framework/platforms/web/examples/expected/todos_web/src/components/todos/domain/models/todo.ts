import { Json } from 'synapsis-web';

/** Todo, as the API answers it. */
export class Todo {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;

  constructor(init: { id: number; title: string; completed: boolean }) {
    this.id = init.id;
    this.title = init.title;
    this.completed = init.completed;
  }

  static fromJson(json: Json): Todo {
    return new Todo({
      id: json['id'] as number,
      title: json['title'] as string,
      completed: json['completed'] as boolean,
    });
  }

  toJson(): Json {
    return {
      id: this.id,
      title: this.title,
      completed: this.completed,
    };
  }

  /** The same value with some fields changed. */
  copyWith(changes: Partial<{ id: number; title: string; completed: boolean }>): Todo {
    return new Todo({ ...this, ...changes });
  }
}
