import { TaskRepository } from '../../data/task_repository';
import { Task } from '../models/task';
import { TaskError } from '../models/task_error';
import { Result } from 'synapsis-web';

/** Adds a task. */
export class CreateTask {
  constructor(private readonly repository: TaskRepository) {}

  async exec(input: Task): Promise<Result<TaskError, Task>> {
    return await this.repository.create(input);
  }
}
