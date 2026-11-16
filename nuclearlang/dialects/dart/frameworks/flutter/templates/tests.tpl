{{#decor.mock.items}}
class Mock{{.}} extends Mock implements {{.}} {}

{{/decor.mock.items}}
void main() {
  group('{{name}}', () {
    setUp(() async {
      await SynapsisTest.start(synapsisConfig(), registerSynapsis{{#decor.offline}}, NetworkStatus.offline{{/decor.offline}});
{{#decor.mock.items}}
      SynapsisTest.replace<{{.}}>(Mock{{.}}());
{{/decor.mock.items}}
    });

    {{members}}
  });
}
