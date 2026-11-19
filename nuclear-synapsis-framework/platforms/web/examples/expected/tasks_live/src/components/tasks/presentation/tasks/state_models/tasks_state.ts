import { Task } from '../../../domain/models/task';
import { TaskError } from '../../../domain/models/task_error';
import { Element, createElement, useStateOf } from 'synapsis-web';

/** The states of the tasks screen: each field is one. */
export enum TasksStateStatus {
  initial = 'initial',
  full = 'full',
  error = 'error',
  loading = 'loading',
}

export class TasksState {
  readonly status: TasksStateStatus;
  readonly full?: Task[];
  readonly error?: TaskError;

  constructor(status: TasksStateStatus, values: { full?: Task[]; error?: TaskError; } = {}) {
    this.status = status;
    this.full = values.full;
    this.error = values.error;
  }

  static initial(): TasksState {
    return new TasksState(TasksStateStatus.initial);
  }

  static full(full: Task[]): TasksState {
    return new TasksState(TasksStateStatus.full, { full });
  }

  static error(error: TaskError): TasksState {
    return new TasksState(TasksStateStatus.error, { error });
  }

  static loading(): TasksState {
    return new TasksState(TasksStateStatus.loading);
  }

  toString(): string {
    return `TasksState.${this.status}`;
  }
}

export interface TasksStateBuilders {
  initial?: () => Element;
  full?: (full: Task[]) => Element;
  error?: (error: TaskError) => Element;
  loading?: () => Element;
  orElse?: () => Element;
}

/** One element for each state of TasksState (read from the screen's provided manager); a state without a builder shows `orElse`. */
export function TasksStateBuilder(builders: TasksStateBuilders): Element {
  return createElement(TasksStateBuilderView, builders);
}

function TasksStateBuilderView(builders: TasksStateBuilders): Element {
  const state = useStateOf(TasksState);
  switch (state.status) {
    case TasksStateStatus.initial:
      return builders.initial?.() ?? builders.orElse?.() ?? null;
    case TasksStateStatus.full:
      return builders.full?.(state.full!) ?? builders.orElse?.() ?? null;
    case TasksStateStatus.error:
      return builders.error?.(state.error!) ?? builders.orElse?.() ?? null;
    case TasksStateStatus.loading:
      return builders.loading?.() ?? builders.orElse?.() ?? null;
  }
}
