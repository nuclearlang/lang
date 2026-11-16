import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/todos/presentation/todos/managers/todos_manager.dart';
import 'package:todos_app/components/todos/presentation/todos/state_models/todos_state.dart';

/// The todos, as a list.
class TodosScreen extends StatelessWidget {
  const TodosScreen({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
        providers: [
          BlocProvider<TodosManager>(create: (_) => inject<TodosManager>()),
        ],
        child: _TodosScreenView(),
      );
}

class _TodosScreenView extends StatelessWidget {
  const _TodosScreenView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Todos')),
      body: TodosStateBuilder<TodosManager>(
        loading: () => Center(child: CircularProgressIndicator()),
        full: (items) => ListView.builder(
          itemCount: items.length,
          itemBuilder: (context, index) => ListTile(title: Text(items[index].title)),
        ),
        error: (e) => Center(child: Text(e.message)),
      ),
    );
  }
}
