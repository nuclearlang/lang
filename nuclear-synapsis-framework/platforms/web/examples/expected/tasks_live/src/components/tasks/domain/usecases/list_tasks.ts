import { TaskRepository } from '../../data/task_repository';
import { Task } from '../models/task';
import { TaskError } from '../models/task_error';
import { Result } from 'synapsis-web';

/** One page of tasks. */
export class ListTasks {
  constructor(private readonly repository: TaskRepository) {}

  async exec(): Promise<Result<TaskError, Task[]>> {
    return await this.repository.all();
  }
}
