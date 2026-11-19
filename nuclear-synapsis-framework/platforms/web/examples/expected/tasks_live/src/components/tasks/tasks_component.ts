import { Task } from './domain/models/task';
import { TaskCreated } from './domain/models/task_created';
import { TaskError } from './domain/models/task_error';
import { CreateTask } from './domain/usecases/create_task';
import { ListTasks } from './domain/usecases/list_tasks';
import { WatchCreatedTasks } from './domain/usecases/watch_created_tasks';
import { Result, Stream, inject } from 'synapsis-web';

/** What the screens and the other components see of tasks: an alias for each of its use cases. */
export class TasksComponent {
  async listTasks(): Promise<Result<TaskError, Task[]>> {
    return await inject(ListTasks).exec();
  }

  async createTask(input: Task): Promise<Result<TaskError, Task>> {
    return await inject(CreateTask).exec(input);
  }

  watchCreatedTasks(): Stream<TaskCreated> {
    return inject(WatchCreatedTasks).exec();
  }
}
