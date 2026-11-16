import { Todo } from './domain/models/todo';
import { TodoError } from './domain/models/todo_error';
import { GetTodo } from './domain/usecases/get_todo';
import { ListTodos } from './domain/usecases/list_todos';
import { Result, inject } from 'synapsis-web';

/** What the screens and the other components see of todos: an alias for each of its use cases. */
export class TodosComponent {
  async listTodos(): Promise<Result<TodoError, Todo[]>> {
    return await inject(ListTodos).exec();
  }

  async getTodo(id: number): Promise<Result<TodoError, Todo>> {
    return await inject(GetTodo).exec(id);
  }
}
