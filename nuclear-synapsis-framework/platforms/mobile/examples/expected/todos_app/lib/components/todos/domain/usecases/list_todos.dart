import 'package:fpdart/fpdart.dart';
import 'package:todos_app/components/todos/data/todo_repository.dart';
import 'package:todos_app/components/todos/domain/models/todo.dart';
import 'package:todos_app/components/todos/domain/models/todo_error.dart';

/// One page of todos.
class ListTodos {
  ListTodos(this.repository);

  final TodoRepository repository;

  Future<Either<TodoError, List<Todo>>> exec() async {
    return await repository.all();
  }
}
