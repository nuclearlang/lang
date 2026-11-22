import { Task } from '../../tasks/data/entities/task.js';
import { NewTask } from '../../tasks/domain/models/task_models.js';
import { TasksAppComponent } from '../../tasks/tasks_appcomponent.js';
import { PlanState } from './states/plan_state.js';
import { Injectable } from '@nestjs/common';
import { AppError, Result } from 'synapsis-nest';
import { Graph, chatModel, next, start, textOf } from 'synapsis-nest/ai';

/** Turns a goal into tasks: the model splits it, then each step becomes a task. */
@Injectable()
export class Planner extends Graph<typeof PlanState> {
  readonly state = PlanState;

  constructor(private readonly tasks: TasksAppComponent) {
    super();
  }

  @start
  @next('save')
  async split(state: PlanState): Promise<Record<string, any>> {
    const reply = await chatModel().invoke(`Split this goal into at most 5 short tasks. Answer only the tasks, one per line, without numbers: ${state.goal}`);
    const titles: string[] = [];
    for (const line of textOf(reply).split('\n')) {
      const title = line.replaceAll(new RegExp('^[\\s\\-*.0-9]+', 'g'), '').trim();
      if (title.length > 0 && titles.length < 5) {
        titles.push(title);
      }
    }
    return { 'titles': titles };
  }

  @next('end')
  async save(state: PlanState): Promise<Record<string, any>> {
    let created = 0;
    const failed: string[] = [];
    for (const title of state.titles) {
      const made: Result<AppError, Task> = await this.tasks.create(new NewTask({ title: title }));
      if (made.isOk) {
        created += 1;
      } else {
        failed.push(`${title}: ${(made.error as AppError).message}`);
      }
    }
    return { 'created': created, 'failed': failed };
  }
}
