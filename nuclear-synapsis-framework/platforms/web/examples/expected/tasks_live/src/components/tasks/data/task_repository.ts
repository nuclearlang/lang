import { Task } from '../domain/models/task';
import { TaskCreated } from '../domain/models/task_created';
import { TaskError } from '../domain/models/task_error';
import { Decode, HttpMethod, Json, Repository, Result, Stream } from 'synapsis-web';

/** The tasks of the API (task): each method is an http call. */
export class TaskRepository extends Repository {
  constructor() {
    super({ path: 'tasks' });
  }

  all(): Promise<Result<TaskError, Task[]>> {
    return this.result(
      () =>
        this.send(HttpMethod.get, '', {
          decode: Decode.list(Task.fromJson),
        }),
      (e) => new TaskError({ message: e.message }),
    );
  }

  create(input: Task): Promise<Result<TaskError, Task>> {
    return this.result(
      () =>
        this.send(HttpMethod.post, '', {
          params: { input },
          decode: Decode.one(Task.fromJson),
        }),
      (e) => new TaskError({ message: e.message }),
    );
  }

  /** what the API pushes when a task is created (over a connection that can push: WebSocket) */
  created(): Stream<TaskCreated> {
    return this.stream('tasks.created', (data) => TaskCreated.fromJson(data as Json));
  }
}
