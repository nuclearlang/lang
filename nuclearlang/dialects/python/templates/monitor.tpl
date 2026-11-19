"""Nuclear Monitor (spec 015): the time, calls, connections and memory of each Nuclear function and method of
{{app}}. Written by `nuclear build --monitor`; the report goes to NUCLEAR_MONITOR_FILE, else
.nuclear/monitor/report.json of the working folder."""

import atexit
import contextvars
import datetime
import json
import os
import socket
import threading
import time
import tracemalloc
from typing import Any


class _Node:
    __slots__ = ("label", "path", "line", "is_async", "calls", "total", "max", "connections", "memory", "children")

    def __init__(self, label: str, path: str, line: int, is_async: bool) -> None:
        self.label = label
        self.path = path
        self.line = line
        self.is_async = is_async
        self.calls = 0
        self.total = 0
        self.max = 0
        self.connections = 0
        self.memory = 0
        self.children: dict[tuple[str, int], "_Node"] = {}


_root = _Node("", "", 0, False)
_current: contextvars.ContextVar[_Node] = contextvars.ContextVar("nuclear_monitor", default=_root)
_started = datetime.datetime.now(datetime.timezone.utc)
_started_ns = time.perf_counter_ns()
_lock = threading.Lock()
_state: dict[str, Any] = {"connections": 0, "dirty": False}
tracemalloc.start()

# a connection is a new socket: HTTP clients and database drivers alike
_connect = socket.socket.connect
_connect_ex = socket.socket.connect_ex


def _counted_connect(self: socket.socket, address: Any) -> None:
    _state["connections"] += 1
    return _connect(self, address)


def _counted_connect_ex(self: socket.socket, address: Any) -> int:
    _state["connections"] += 1
    return _connect_ex(self, address)


socket.socket.connect = _counted_connect
socket.socket.connect_ex = _counted_connect_ex


def _to_report(node: _Node) -> dict[str, Any]:
    children = sorted((_to_report(c) for c in list(node.children.values())), key=lambda c: -c["total_ms"])
    total = node.total / 1e6
    return {
        "label": node.label,
        "path": node.path,
        "line": node.line,
        "async": node.is_async,
        "calls": node.calls,
        "total_ms": round(total, 3),
        "self_ms": round(max(0.0, total - sum(c["total_ms"] for c in children)), 3),
        "max_ms": round(node.max / 1e6, 3),
        "connections": node.connections,
        "memory_bytes": node.memory,
        "children": children,
    }


def _report() -> dict[str, Any]:
    return {
        "format": 1,
        "app": "{{app}}",
        "runtime": "python",
        "started": _started.isoformat(),
        "updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "wall_ms": round((time.perf_counter_ns() - _started_ns) / 1e6, 3),
        "notes": ["memory measured with tracemalloc: the times include its cost"],
        "roots": _to_report(_root)["children"],
    }


def _write() -> None:
    if not _state["dirty"]:
        return
    _state["dirty"] = False
    path = os.environ.get("NUCLEAR_MONITOR_FILE") or os.path.join(os.getcwd(), ".nuclear", "monitor", "report.json")
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with _lock:
            text = json.dumps(_report(), indent=1)
        with open(path + ".tmp", "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(path + ".tmp", path)
    except (OSError, RuntimeError):
        pass  # the report is best effort: the app never fails because of it


def _every_two_seconds() -> None:
    while True:
        time.sleep(2)
        _write()


threading.Thread(target=_every_two_seconds, name="nuclear-monitor", daemon=True).start()
atexit.register(_write)


class NuclearMonitor:
    @staticmethod
    def enter(label: str, path: str, line: int, is_async: bool) -> tuple[Any, ...]:
        parent = _current.get()
        node = parent.children.get((path, line))
        if node is None:
            with _lock:
                node = parent.children.setdefault((path, line), _Node(label, path, line, is_async))
        token = _current.set(node)
        return (node, token, time.perf_counter_ns(), tracemalloc.get_traced_memory()[0], _state["connections"])

    @staticmethod
    def exit(span: tuple[Any, ...]) -> None:
        node, token, start, memory, connections = span
        elapsed = time.perf_counter_ns() - start
        node.calls += 1
        node.total += elapsed
        if elapsed > node.max:
            node.max = elapsed
        node.connections += _state["connections"] - connections
        node.memory += max(0, tracemalloc.get_traced_memory()[0] - memory)
        _state["dirty"] = True
        _current.reset(token)
