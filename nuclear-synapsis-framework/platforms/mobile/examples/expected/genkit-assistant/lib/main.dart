import 'package:flutter/material.dart' hide Summary;
import 'package:genkit_assistant/synapsis.g.dart';

Future<void> main() async {
  await startSynapsis();
  runApp(App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(title: 'Assistant', routerConfig: appRouter);
  }
}
