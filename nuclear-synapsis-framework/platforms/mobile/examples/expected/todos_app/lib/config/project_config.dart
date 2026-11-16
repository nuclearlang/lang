import 'package:synapsis/synapsis.dart';

/// Global configuration: the connections and the services of the whole app.
class ProjectConfig extends AppConfig {
  @override
  final List<Connection> connections = [
    Http(
      connectionName: 'todos',
      baseUrl: 'https://jsonplaceholder.typicode.com',
    ),
    Http(
      baseUrl: 'https://api.example.com/',
      connectTimeout: Duration(seconds: 10),
      receiveTimeout: Duration(seconds: 10),
      interceptors: [SessionInterceptor(), HttpLogInterceptor()],
    ),
  ];
  @override
  final List<Global> globals = [Events(), SessionManager(timeout: Duration(minutes: 30)), NetworkManager()];
}
