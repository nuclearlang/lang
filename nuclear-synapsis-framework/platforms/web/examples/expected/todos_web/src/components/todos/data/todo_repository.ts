import { Todo } from '../domain/models/todo';
import { TodoError } from '../domain/models/todo_error';
import { Decode, HttpMethod, Repository, Result } from 'synapsis-web';

/** The todos of the API (todos): each method is an http call. */
export class TodoRepository extends Repository {
  constructor() {
    super({ path: 'todos', connection: 'todos' });
  }

  all(): Promise<Result<TodoError, Todo[]>> {
    return this.result(
      () =>
        this.send(HttpMethod.get, '', {
          decode: Decode.list(Todo.fromJson),
        }),
      (e) => new TodoError({ message: e.message }),
    );
  }

  one(id: number): Promise<Result<TodoError, Todo>> {
    return this.result(
      () =>
        this.send(HttpMethod.get, ':id', {
          params: { id },
          decode: Decode.one(Todo.fromJson),
        }),
      (e) => new TodoError({ message: e.message }),
    );
  }
}
