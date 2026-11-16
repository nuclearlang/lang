import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';
import 'package:synapsis/synapsis.dart';
import 'package:synapsis/testing.dart';
import 'package:todos_app/components/todos/data/todo_repository.dart';
import 'package:todos_app/components/todos/domain/usecases/list_todos.dart';
import 'package:todos_app/synapsis.g.dart';

/// The tests of todos: the repository is a mock; everything else is the real code.
class MockTodoRepository extends Mock implements TodoRepository {}

void main() {
  group('TodosTest', () {
    setUp(() async {
      await SynapsisTest.start(synapsisConfig(), registerSynapsis);
      SynapsisTest.replace<TodoRepository>(MockTodoRepository());
    });

    setUp(() async {
      when(() => inject<TodoRepository>().all()).thenReturnAsync(Right([]));
    });

    test('ListTodos answers the todos of the API', () async {
      final result = await inject<ListTodos>().exec();
      expect(result, isOkWith([]));
    });
  });
}
