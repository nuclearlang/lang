import { TaskRepository } from '../../data/task_repository';
import { TaskCreated } from '../models/task_created';
import { Stream } from 'synapsis-web';

/** What TaskRepository.created receives from the API, for the screens of tasks. */
export class WatchCreatedTasks {
  constructor(private readonly repository: TaskRepository) {}

  exec(): Stream<TaskCreated> {
    return this.repository.created();
  }
}
