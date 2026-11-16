import 'package:flutter/material.dart';
import 'package:synapsis/synapsis.dart';
import 'package:todos_app/synapsis.g.dart';

Future<void> main() async {
  await startSynapsis();
  runApp(App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'TodosApp',
      routerConfig: appRouter,
      builder: (context, child) => NetworkWrapper(child: child!),
    );
  }
}
