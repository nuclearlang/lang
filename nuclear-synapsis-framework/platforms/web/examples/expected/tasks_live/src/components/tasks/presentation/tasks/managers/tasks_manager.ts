import { Task } from '../../../domain/models/task';
import { TaskError } from '../../../domain/models/task_error';
import { TasksComponent } from '../../../tasks_component';
import { TasksState } from '../state_models/tasks_state';
import { Result, StateManager } from 'synapsis-web';

/**
 * The state of the tasks screen: it loads the tasks when it is created, and again each time the API says one was
 * created (until the screen leaves).
 */
export class TasksManager extends StateManager<TasksState> {
  constructor(private readonly tasks: TasksComponent) {
    super(TasksState.initial());
    this.load();
    this.listen(this.tasks.watchCreatedTasks(), (created) => this.load());
  }

  loading(): void {
    this.emit(TasksState.loading());
  }

  async load(): Promise<void> {
    this.loading();
    const result = await this._load();
    this.emit(result.match(TasksState.error, TasksState.full));
  }

  private async _load(): Promise<Result<TaskError, Task[]>> {
    return await this.tasks.listTasks();
  }
}
