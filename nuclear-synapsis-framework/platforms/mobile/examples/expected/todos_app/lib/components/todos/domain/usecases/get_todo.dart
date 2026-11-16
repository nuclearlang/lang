import 'package:fpdart/fpdart.dart';
import 'package:todos_app/components/todos/data/todo_repository.dart';
import 'package:todos_app/components/todos/domain/models/todo.dart';
import 'package:todos_app/components/todos/domain/models/todo_error.dart';

/// One todo by its id.
class GetTodo {
  GetTodo(this.repository);

  final TodoRepository repository;

  Future<Either<TodoError, Todo>> exec(int id) async {
    return await repository.one(id);
  }
}
