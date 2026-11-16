import { TodoRepository } from '../../data/todo_repository';
import { Todo } from '../models/todo';
import { TodoError } from '../models/todo_error';
import { Result } from 'synapsis-web';

/** One todo by its id. */
export class GetTodo {
  constructor(private readonly repository: TodoRepository) {}

  async exec(id: number): Promise<Result<TodoError, Todo>> {
    return await this.repository.one(id);
  }
}
