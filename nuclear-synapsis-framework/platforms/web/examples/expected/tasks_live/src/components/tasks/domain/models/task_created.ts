import { Json } from 'synapsis-web';

/** A task the API created, as its event says it. */
export class TaskCreated {
  readonly id: number;
  readonly title: string;

  constructor(init: { id: number; title: string }) {
    this.id = init.id;
    this.title = init.title;
  }

  static fromJson(json: Json): TaskCreated {
    return new TaskCreated({
      id: json['id'] as number,
      title: json['title'] as string,
    });
  }

  toJson(): Json {
    return {
      id: this.id,
      title: this.title,
    };
  }

  /** The same value with some fields changed. */
  copyWith(changes: Partial<{ id: number; title: string }>): TaskCreated {
    return new TaskCreated({ ...this, ...changes });
  }
}
