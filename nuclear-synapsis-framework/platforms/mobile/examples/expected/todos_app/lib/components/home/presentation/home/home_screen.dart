import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/components/home/presentation/home/managers/home_manager.dart';
import 'package:todos_app/components/home/presentation/home/state_models/home_state.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => MultiBlocProvider(
        providers: [
          BlocProvider<HomeManager>(create: (_) => inject<HomeManager>()),
        ],
        child: _HomeScreenView(),
      );
}

class _HomeScreenView extends StatelessWidget {
  const _HomeScreenView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Home')),
      body: HomeStateBuilder<HomeManager>(
        loading: () => Center(child: CircularProgressIndicator()),
        items: (items) => ListView(children: items.map((i) => ListTile(title: Text(i))).toList()),
        error: (message) => Center(child: Text(message)),
      ),
    );
  }
}
