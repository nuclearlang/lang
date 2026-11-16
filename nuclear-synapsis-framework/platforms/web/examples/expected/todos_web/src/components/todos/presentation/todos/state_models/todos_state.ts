import { Todo } from '../../../domain/models/todo';
import { TodoError } from '../../../domain/models/todo_error';
import { Element, createElement, useStateOf } from 'synapsis-web';

/** The states of the todos screen: each field is one. */
export enum TodosStateStatus {
  initial = 'initial',
  full = 'full',
  error = 'error',
  loading = 'loading',
}

export class TodosState {
  readonly status: TodosStateStatus;
  readonly full?: Todo[];
  readonly error?: TodoError;

  constructor(status: TodosStateStatus, values: { full?: Todo[]; error?: TodoError; } = {}) {
    this.status = status;
    this.full = values.full;
    this.error = values.error;
  }

  static initial(): TodosState {
    return new TodosState(TodosStateStatus.initial);
  }

  static full(full: Todo[]): TodosState {
    return new TodosState(TodosStateStatus.full, { full });
  }

  static error(error: TodoError): TodosState {
    return new TodosState(TodosStateStatus.error, { error });
  }

  static loading(): TodosState {
    return new TodosState(TodosStateStatus.loading);
  }

  toString(): string {
    return `TodosState.${this.status}`;
  }
}

export interface TodosStateBuilders {
  initial?: () => Element;
  full?: (full: Todo[]) => Element;
  error?: (error: TodoError) => Element;
  loading?: () => Element;
  orElse?: () => Element;
}

/** One element for each state of TodosState (read from the screen's provided manager); a state without a builder shows `orElse`. */
export function TodosStateBuilder(builders: TodosStateBuilders): Element {
  return createElement(TodosStateBuilderView, builders);
}

function TodosStateBuilderView(builders: TodosStateBuilders): Element {
  const state = useStateOf(TodosState);
  switch (state.status) {
    case TodosStateStatus.initial:
      return builders.initial?.() ?? builders.orElse?.() ?? null;
    case TodosStateStatus.full:
      return builders.full?.(state.full!) ?? builders.orElse?.() ?? null;
    case TodosStateStatus.error:
      return builders.error?.(state.error!) ?? builders.orElse?.() ?? null;
    case TodosStateStatus.loading:
      return builders.loading?.() ?? builders.orElse?.() ?? null;
  }
}
