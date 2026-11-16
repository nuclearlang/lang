import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/todos/domain/models/todo.dart';
import 'package:todos_app/components/todos/domain/models/todo_error.dart';
import 'package:todos_app/components/todos/domain/usecases/get_todo.dart';
import 'package:todos_app/components/todos/domain/usecases/list_todos.dart';

/// What the screens and the other components see of todos: an alias for each of its use cases.
class TodosComponent {
  Future<Either<TodoError, List<Todo>>> listTodos() async {
    return await inject<ListTodos>().exec();
  }

  Future<Either<TodoError, Todo>> getTodo(int id) async {
    return await inject<GetTodo>().exec(id);
  }
}
