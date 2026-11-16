import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:todos_app/components/todos/domain/models/todo.dart';
import 'package:todos_app/components/todos/domain/models/todo_error.dart';

/// The states of the todos screen: each field is one.
enum TodosStateStatus { initial, full, error, loading }

class TodosState {
  const TodosState._({required this.status, this.full, this.error});

  const TodosState.initial() : this._(status: TodosStateStatus.initial);
  const TodosState.full(List<Todo> full) : this._(status: TodosStateStatus.full, full: full);
  const TodosState.error(TodoError error) : this._(status: TodosStateStatus.error, error: error);
  const TodosState.loading() : this._(status: TodosStateStatus.loading);

  final TodosStateStatus status;
  final List<Todo>? full;
  final TodoError? error;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TodosState &&
          status == other.status &&
          listEquals(full, other.full) &&
          error == other.error;

  @override
  int get hashCode => Object.hash(status, Object.hashAll([Object.hashAll(full ?? const []), error, ]));

  @override
  String toString() => 'TodosState.${status.name}';
}

/// One widget for each state of [TodosState]; a state without a builder shows [orElse].
class TodosStateBuilder<M extends StateStreamable<TodosState>> extends StatelessWidget {
  const TodosStateBuilder({super.key, this.initial, this.full, this.error, this.loading, this.orElse});

  final Widget Function()? initial;
  final Widget Function(List<Todo> full)? full;
  final Widget Function(TodoError error)? error;
  final Widget Function()? loading;
  final Widget Function()? orElse;

  @override
  Widget build(BuildContext context) => BlocBuilder<M, TodosState>(
        builder: (context, state) =>
            switch (state.status) {
              TodosStateStatus.initial => initial?.call(),
              TodosStateStatus.full => full?.call(state.full!),
              TodosStateStatus.error => error?.call(state.error!),
              TodosStateStatus.loading => loading?.call(),
            } ??
            orElse?.call() ??
            const SizedBox.shrink(),
      );
}
