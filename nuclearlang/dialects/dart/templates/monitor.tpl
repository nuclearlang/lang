// Nuclear Monitor (spec 015): the time, calls, connections and memory of each Nuclear function and method of
// {{app}}. Written by `nuclear build --monitor`; the report goes to NUCLEAR_MONITOR_FILE, else to the collector the
// build was given (an app without the project's files: a browser's, a phone's), else .nuclear/monitor/report.json of
// the working folder. In a browser the host is monitor_web.dart; elsewhere this file is its own host.
// ignore_for_file: avoid_classes_with_only_static_members

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'monitor.dart' if (dart.library.js_interop) 'monitor_web.dart' as host;

class MonitorNode {
  MonitorNode(this.label, this.path, this.line, this.isAsync);

  final String label;
  final String path;
  final int line;
  final bool isAsync;
  int calls = 0;
  int totalUs = 0;
  int maxUs = 0;
  int connections = 0;
  int memoryBytes = 0;
  final Map<String, MonitorNode> children = {};
}

class MonitorSpan {
  MonitorSpan(this.node, this.parent, this.parentZone, this.start, this.memory, this.connections);

  final MonitorNode node;
  final MonitorNode? parent;
  final Zone? parentZone;
  final int start;
  final int memory;
  final int connections;
}

final MonitorNode _root = MonitorNode('', '', 0, false);
final Stopwatch _clock = Stopwatch()..start();
final DateTime _started = DateTime.now().toUtc();
const Symbol _zoneKey = #nuclearMonitor;
// the node of the synchronous call running now, and the zone it runs in; an async body has a zone of its own
MonitorNode? _current;
Zone? _currentZone;
const String _collector = '{{url}}';
int _ioConnections = 0;
bool _posting = false;
bool _dirty = false;
bool _running = false;
int _lastWrite = 0;
Timer? _pending;

// a connection is a new socket: HTTP clients and database drivers alike
final class _CountedSockets extends IOOverrides {
  @override
  Future<Socket> socketConnect(dynamic host, int port,
      {dynamic sourceAddress, int sourcePort = 0, Duration? timeout}) {
    if (!_posting) _ioConnections++;
    return super.socketConnect(host, port, sourceAddress: sourceAddress, sourcePort: sourcePort, timeout: timeout);
  }

  @override
  Future<ConnectionTask<Socket>> socketStartConnect(dynamic host, int port,
      {dynamic sourceAddress, int sourcePort = 0}) {
    if (!_posting) _ioConnections++;
    return super.socketStartConnect(host, port, sourceAddress: sourceAddress, sourcePort: sourcePort);
  }
}

// the host of a program with dart:io (a server, a desktop, a phone): its sockets, its resident set, its files
const bool hostIsBrowser = false;
void hostStart() => IOOverrides.global = _CountedSockets();
int hostConnections() => _ioConnections;
int hostMemory() => ProcessInfo.currentRss;

void hostSave(String report, String collector) {
  final file = Platform.environment['NUCLEAR_MONITOR_FILE'];
  if (file == null && collector.isNotEmpty) {
    _post(report, collector);
    return;
  }
  final path = file ?? '${Directory.current.path}/.nuclear/monitor/report.json';
  try {
    final target = File(path);
    target.parent.createSync(recursive: true);
    File('$path.tmp')
      ..writeAsStringSync(report)
      ..renameSync(target.path);
  } on FileSystemException {
    // the report is best effort: the app never fails because of it
  }
}

// a phone's app: to the collector, its own connection not counted
Future<void> _post(String report, String collector) async {
  _posting = true;
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 2);
  try {
    final request = await client.postUrl(Uri.parse(collector));
    _posting = false;
    request.headers.contentType = ContentType.text;
    request.write(report);
    await (await request.close()).drain<void>();
  } on Object {
    // no collector listening: the report is best effort
  } finally {
    _posting = false;
    client.close();
  }
}

void _start() {
  _running = true;
  host.hostStart();
}

MonitorNode _parent() {
  if (_current != null && identical(_currentZone, Zone.current)) return _current!;
  return (Zone.current[_zoneKey] as MonitorNode?) ?? _root;
}

MonitorSpan _open(String label, String path, int line, bool isAsync) {
  if (!_running) _start();
  final parent = _parent();
  final node = parent.children.putIfAbsent('$path:$line', () => MonitorNode(label, path, line, isAsync));
  return MonitorSpan(node, _current, _currentZone, _clock.elapsedMicroseconds, host.hostMemory(), host.hostConnections());
}

void _close(MonitorSpan span) {
  final us = _clock.elapsedMicroseconds - span.start;
  final node = span.node;
  node.calls++;
  node.totalUs += us;
  if (us > node.maxUs) node.maxUs = us;
  node.connections += host.hostConnections() - span.connections;
  final grown = host.hostMemory() - span.memory;
  if (grown > 0) node.memoryBytes += grown;
  _dirty = true;
  _schedule();
}

double _ms(int us) => us / 1000;

Map<String, Object> _toReport(MonitorNode node) {
  final children = node.children.values.map(_toReport).toList()
    ..sort((a, b) => (b['total_ms'] as double).compareTo(a['total_ms'] as double));
  final inner = children.fold<double>(0, (sum, c) => sum + (c['total_ms'] as double));
  final total = _ms(node.totalUs);
  return {
    'label': node.label,
    'path': node.path,
    'line': node.line,
    'async': node.isAsync,
    'calls': node.calls,
    'total_ms': total,
    'self_ms': total > inner ? ((total - inner) * 1000).round() / 1000 : 0.0,
    'max_ms': _ms(node.maxUs),
    'connections': node.connections,
    'memory_bytes': node.memoryBytes,
    'children': children,
  };
}

Map<String, Object> _report() => {
      'format': 1,
      'app': '{{app}}',
      'runtime': host.hostIsBrowser ? 'dart-web' : 'dart',
      'started': _started.toIso8601String(),
      'updated': DateTime.now().toUtc().toIso8601String(),
      'wall_ms': _ms(_clock.elapsedMicroseconds),
      'notes': [
        host.hostIsBrowser
            ? 'memory is the JavaScript heap grown during the calls (Chromium); a connection is a request the page opens'
            : 'memory is the resident set grown during the calls; async calls run in zones of their own',
      ],
      'roots': _toReport(_root)['children']!,
    };

// at most one write every two seconds; a one-shot timer, so a program that ends is not kept alive for long
void _schedule() {
  if (_pending != null) return;
  final wait = 2000000 - (_clock.elapsedMicroseconds - _lastWrite);
  _pending = Timer(Duration(microseconds: wait > 0 ? wait : 0), _write);
}

void _write() {
  _pending = null;
  if (!_dirty) return;
  _dirty = false;
  _lastWrite = _clock.elapsedMicroseconds;
  host.hostSave(const JsonEncoder.withIndent(' ').convert(_report()), _collector);
}

class NuclearMonitor {
  /// A synchronous call begins.
  static MonitorSpan enter(String label, String path, int line) {
    final span = _open(label, path, line, false);
    _current = span.node;
    _currentZone = Zone.current;
    return span;
  }

  /// A synchronous call ends (in a `finally`).
  static void exit(MonitorSpan span) {
    _close(span);
    _current = span.parent;
    _currentZone = span.parentZone;
  }

  /// An async call: its body runs in a zone that carries its node, so what it awaits is measured under it.
  static Future<T> run<T>(String label, String path, int line, Future<T> Function() body) async {
    final span = _open(label, path, line, true);
    try {
      return await runZoned(body, zoneValues: {_zoneKey: span.node});
    } finally {
      _close(span);
    }
  }
}
