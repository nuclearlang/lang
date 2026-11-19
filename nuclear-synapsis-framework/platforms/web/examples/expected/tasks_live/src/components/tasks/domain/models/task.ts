import { Json } from 'synapsis-web';

/** Task, as the API answers it. */
export class Task {
  readonly id: number;
  readonly title: string;
  readonly done: boolean;

  constructor(init: { id: number; title: string; done: boolean }) {
    this.id = init.id;
    this.title = init.title;
    this.done = init.done;
  }

  static fromJson(json: Json): Task {
    return new Task({
      id: json['id'] as number,
      title: json['title'] as string,
      done: json['done'] as boolean,
    });
  }

  toJson(): Json {
    return {
      id: this.id,
      title: this.title,
      done: this.done,
    };
  }

  /** The same value with some fields changed. */
  copyWith(changes: Partial<{ id: number; title: string; done: boolean }>): Task {
    return new Task({ ...this, ...changes });
  }
}
