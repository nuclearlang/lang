// The host of Nuclear Monitor's runtime (monitor.dart) in a browser, where dart:io has no files, sockets nor
// process: the requests the page opens (fetch, XMLHttpRequest), the JavaScript heap (Chromium), and the report
// posted to the collector the build was given with the page's own fetch (not counted).

import 'dart:js_interop';
import 'dart:js_interop_unsafe';

const bool hostIsBrowser = true;

const String _install = r'''
(() => {
  if (globalThis.__nuclearMonitor) return;
  const m = (globalThis.__nuclearMonitor = { requests: 0 });
  const fetch = globalThis.fetch;
  m.post = (url, body) => fetch.call(globalThis, url, { method: 'POST', body }).catch(() => undefined);
  globalThis.fetch = function (...args) {
    m.requests++;
    return fetch.apply(this, args);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    m.requests++;
    return open.apply(this, args);
  };
})();
''';

JSObject? _page;

void hostStart() {
  globalContext.callMethod<JSAny?>('eval'.toJS, _install.toJS);
  _page = globalContext['__nuclearMonitor'] as JSObject?;
}

int hostConnections() => (_page?['requests'] as JSNumber?)?.toDartInt ?? 0;

int hostMemory() {
  final memory = (globalContext['performance'] as JSObject?)?['memory'] as JSObject?;
  return (memory?['usedJSHeapSize'] as JSNumber?)?.toDartInt ?? 0;
}

void hostSave(String report, String collector) {
  if (collector.isNotEmpty) _page?.callMethod<JSAny?>('post'.toJS, collector.toJS, report.toJS);
}
