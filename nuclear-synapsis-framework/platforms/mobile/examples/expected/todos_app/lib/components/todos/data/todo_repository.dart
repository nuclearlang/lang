import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/todos/domain/models/todo.dart';
import 'package:todos_app/components/todos/domain/models/todo_error.dart';

/// The todos of the API (todos): each method is an http call.
class TodoRepository extends Repository {
  TodoRepository() : super(path: 'todos', connection: 'todos');

  Future<Either<TodoError, List<Todo>>> all() => attempt(
        () => send(
          HttpMethod.get,
          '',
          decode: Decode.list(Todo.fromJson),
        ),
        Right.new,
        (e) => Left(TodoError(message: e.message)),
      );

  Future<Either<TodoError, Todo>> one(int id) => attempt(
        () => send(
          HttpMethod.get,
          ':id',
          params: {'id': id},
          decode: Decode.one(Todo.fromJson),
        ),
        Right.new,
        (e) => Left(TodoError(message: e.message)),
      );
}
