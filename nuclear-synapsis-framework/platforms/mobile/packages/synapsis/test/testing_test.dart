import 'package:synapsis/synapsis.dart';
import 'package:synapsis/testing.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class Repo extends Repository {
  Repo() : super(path: 'items');

  Future<String> name(int id) => send(HttpMethod.get, ':id', params: {'id': id}, decode: Decode.value);
}

class MockRepo extends Mock implements Repo {}

class Config extends AppConfig {
  @override
  final List<Connection> connections = [Http(baseUrl: 'https://api.test/')];

  @override
  final List<Global> globals = [Events(), SessionManager(), NetworkManager()];
}

void main() {
  test('start answers the requests without network and records them', () async {
    await SynapsisTest.start(Config(), () async => Synapsis.di.registerLazySingleton(Repo.new));
    SynapsisTest.respondWith('Rick');
    expect(await inject<Repo>().name(7), 'Rick');
    expect(SynapsisTest.requests.single.path, '/items/7');
    expect(inject<NetworkManager>().online, isTrue);
  });

  test('NetworkManager reports the status given to start', () async {
    await SynapsisTest.start(Config(), null, NetworkStatus.offline);
    expect(inject<NetworkManager>().online, isFalse);
  });

  test('login starts a session', () async {
    await SynapsisTest.start(Config());
    await SynapsisTest.startSession('ana', roles: ['admin']);
    expect(Acl.can(roles: ['admin']), isTrue);
  });

  test('a mocktail mock replaces a class and returns async values', () async {
    await SynapsisTest.start(Config());
    final mock = MockRepo();
    SynapsisTest.replace<Repo>(mock);
    when(() => mock.name(1)).thenReturnAsync('Morty');
    expect(await inject<Repo>().name(1), 'Morty');
    verify(() => mock.name(1)).called(1);
  });

  test('Either matchers', () {
    expect(const Right<String, int>(1), isOk);
    expect(const Left<String, int>('x'), isErr);
    expect(const Right<String, int>(2), isOkWith(2));
    expect(const Left<String, int>('bad'), isErrWith(contains('ba')));
    expect(const Left<String, int>('bad'), isNot(isOk));
  });

  testWidgets('pumpScreen and tapText', (tester) async {
    var taps = 0;
    await tester.pumpScreen(
      Scaffold(
        body: TextButton(onPressed: () => taps++, child: const Text('Go')),
      ),
    );
    await tester.tapText('Go');
    expect(taps, 1);
  });
}
