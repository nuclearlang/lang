import 'package:clean_flutter_project/main.dart';
import 'package:clean_flutter_project/shared/screens/start_screen.dart';
import 'package:clean_flutter_project/synapsis.g.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:synapsis/testing.dart';

/// Integration test: the real app on a device or emulator (nuclear test --integration).
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('AppTest', () {

    testWidgets('the app starts on the splash, then the list of characters; favorites asks for a session', (tester) async {
      await startSynapsis();
      await tester.pumpWidget(App());
      await tester.pumpAndSettle();
      expect(find.byType(StartScreen), findsOneWidget);
      await tester.pump(Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(find.text('Characters'), findsWidgets);
      await tester.tapText('Favorites');
      expect(find.text('Sign in'), findsOneWidget);
    });
  });
}
