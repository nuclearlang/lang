import 'package:clean_flutter_project/shared/widgets/offline_banner.dart';
import 'package:clean_flutter_project/synapsis.g.dart';
import 'package:flutter/material.dart' hide Page;
import 'package:synapsis/synapsis.dart';

Future<void> main() async {
  await startSynapsis();
  runApp(App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'shared.app.title'.tr(),
      locale: Translations.locale,
      supportedLocales: Translations.supportedLocales,
      localizationsDelegates: Translations.delegates,
      routerConfig: appRouter,
      builder: (context, child) => NetworkWrapper(offline: OfflineBanner(), child: child!),
    );
  }
}
