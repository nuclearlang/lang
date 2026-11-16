import { TodoRepository } from '../../data/todo_repository';
import { Todo } from '../models/todo';
import { TodoError } from '../models/todo_error';
import { Result } from 'synapsis-web';

/** One page of todos. */
export class ListTodos {
  constructor(private readonly repository: TodoRepository) {}

  async exec(): Promise<Result<TodoError, Todo[]>> {
    return await this.repository.all();
  }
}
