import { Todo } from '../../../domain/models/todo';
import { TodoError } from '../../../domain/models/todo_error';
import { TodosComponent } from '../../../todos_component';
import { TodosState } from '../state_models/todos_state';
import { Result, StateManager } from 'synapsis-web';

/** The state of the todos screen: it loads the first page when it is created. */
export class TodosManager extends StateManager<TodosState> {
  constructor(private readonly todos: TodosComponent) {
    super(TodosState.initial());
    this.load();
  }

  loading(): void {
    this.emit(TodosState.loading());
  }

  async load(): Promise<void> {
    this.loading();
    const result = await this._load();
    this.emit(result.match(TodosState.error, TodosState.full));
  }

  private async _load(): Promise<Result<TodoError, Todo[]>> {
    return await this.todos.listTodos();
  }
}
