import 'package:fpdart/fpdart.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/todos/domain/models/todo.dart';
import 'package:todos_app/components/todos/domain/models/todo_error.dart';
import 'package:todos_app/components/todos/presentation/todos/state_models/todos_state.dart';
import 'package:todos_app/components/todos/todos_component.dart';

/// The state of the todos screen: it loads the first page when it is created.
class TodosManager extends StateManager<TodosState> {
  TodosManager(this.todos) : super(const TodosState.initial()) {
    load();
  }

  final TodosComponent todos;

  void loading() => emit(TodosState.loading());

  Future<void> load() async {
    loading();
    final result = await _load();
    emit(result.match(TodosState.error, TodosState.full));
  }

  Future<Either<TodoError, List<Todo>>> _load() async {
    return await todos.listTodos();
  }
}
