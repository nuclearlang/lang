"""Telemetry (spec 012, `plugins(telemetry = true)`): traces and metrics over OTLP/HTTP to Datadog, New Relic,
Grafana or any OpenTelemetry collector, declared as one more connection of `config/project_config.nuc`.

Every destination is the same exporter with another URL and other headers: the vendors are data, not code.
What is measured without a line of Nuclear: each HTTP request and each use case. The transpiler writes
`@traced("<component> › usecase › <Class>.exec")` on every use case that is not `@untraced` (the name is a constant,
never computed per call); an `Err` marks its span as an error. A route marked `@untraced` starts no trace.
`Metric.count` / `Metric.record` are the two explicit words.
"""

from __future__ import annotations

import base64
import functools
import inspect
from collections.abc import Callable, Sequence
from typing import Any, cast

from opentelemetry import metrics, trace
from opentelemetry.context import Context
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import Counter, Histogram, MeterProvider, UpDownCounter
from opentelemetry.sdk.metrics.export import AggregationTemporality, MetricReader, PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import Decision, ParentBased, Sampler, SamplingResult, TraceIdRatioBased
from opentelemetry.trace import Link, SpanKind, Status, StatusCode
from opentelemetry.util.types import Attributes

from .config import Connection, env
from .result import Result

__all__ = ["Datadog", "Grafana", "Metric", "NewRelic", "Otlp", "Telemetry", "traced"]

_DELTA = {Counter: AggregationTemporality.DELTA, Histogram: AggregationTemporality.DELTA, UpDownCounter: AggregationTemporality.CUMULATIVE}
# the open Telemetry connection: without one, @traced and Metric cost one check and do nothing
_active: Telemetry | None = None


class Telemetry(Connection):
    """Where the app's traces and metrics go. `url` is the OTLP/HTTP base (`/v1/traces` and `/v1/metrics` are added);
    `sample` the share of the traces kept (1 = all), decided once at the root of each trace."""

    name = "telemetry"
    delta = False  # the metrics' temporality the destination wants

    def __init__(self, url: str, headers: dict[str, str] | None = None, service: str = "", sample: float = 1.0) -> None:
        self.url = url.rstrip("/")
        self.headers = headers or {}
        # the name the vendor shows: this, else OTEL_SERVICE_NAME, else app(name) of config.nuc (create_app's title)
        self.service = service or env("OTEL_SERVICE_NAME")
        self.sample = sample
        # the request spans that start no trace: `GET /health` of the routes marked @untraced
        self.untraced: set[str] = set()
        # where spans and metrics go; the OTLP exporters unless set before open (tests read them in memory)
        self.processor: SpanProcessor | None = None
        self.reader: MetricReader | None = None
        self.tracer_provider: TracerProvider | None = None
        self.meter_provider: MeterProvider | None = None
        self.tracer: trace.Tracer | None = None
        self.meter: metrics.Meter | None = None
        self.instruments: dict[str, Any] = {}

    def instrument(self, app: Any) -> None:
        """Called by create_app once the routes are mounted: every request gets its span but the @untraced ones."""
        from fastapi.routing import APIRoute
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        for r in getattr(app.state, "synapsis_routes", []):
            if isinstance(r, APIRoute) and getattr(r.endpoint, "__synapsis_untraced__", False):
                self.untraced.update(f"{m} {r.path}" for m in r.methods or ())
        self.service = self.service or app.title
        self._start()
        FastAPIInstrumentor.instrument_app(app, tracer_provider=self.tracer_provider, meter_provider=self.meter_provider)

    async def open(self) -> None:
        self._start()

    async def close(self) -> None:
        global _active
        # flushes what is still in the batch before the process ends
        if self.tracer_provider:
            self.tracer_provider.shutdown()
        if self.meter_provider:
            self.meter_provider.shutdown()
        if _active is self:
            _active = None

    def _start(self) -> None:
        """The providers of this connection (not OpenTelemetry's global ones, which a process may set only once)."""
        global _active
        _active = self
        if self.tracer_provider:
            return
        resource = Resource.create({"service.name": self.service or "app"})
        self.processor = self.processor or BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{self.url}/v1/traces", headers=self.headers))
        self.tracer_provider = TracerProvider(resource=resource, sampler=_Sampler(self.untraced, self.sample))
        self.tracer_provider.add_span_processor(self.processor)
        self.tracer = self.tracer_provider.get_tracer("synapsis")
        self.reader = self.reader or PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=f"{self.url}/v1/metrics", headers=self.headers, preferred_temporality=_DELTA if self.delta else None)
        )
        self.meter_provider = MeterProvider(resource=resource, metric_readers=[self.reader])
        self.meter = self.meter_provider.get_meter("synapsis")


class Otlp(Telemetry):
    """Any OpenTelemetry collector (Grafana Alloy, the OTel Collector, Jaeger, Tempo): `Otlp(url = "http://localhost:4318")`."""


class Datadog(Telemetry):
    """Datadog. By default through the local Datadog Agent with its OTLP receiver on (port 4318); without an Agent,
    `url` is the OTLP intake of the account's site and `apiKey` goes in `dd-api-key`."""

    delta = True  # Datadog's metric intake accepts only delta temporality

    def __init__(self, api_key: str = "", url: str = "http://localhost:4318", service: str = "", sample: float = 1.0) -> None:
        super().__init__(url, {"dd-api-key": api_key} if api_key else {}, service, sample)


class NewRelic(Telemetry):
    """New Relic's native OTLP endpoint; `licenseKey` is the ingest license key, `region` `us` or `eu`."""

    def __init__(self, license_key: str, region: str = "us", service: str = "", sample: float = 1.0) -> None:
        host = "otlp.eu01.nr-data.net" if region == "eu" else "otlp.nr-data.net"
        super().__init__(f"https://{host}:4318", {"api-key": license_key}, service, sample)


class Grafana(Telemetry):
    """Grafana Cloud's OTLP gateway (`https://otlp-gateway-<zone>.grafana.net/otlp`, Basic auth with the stack's
    instance id and an access policy token), or a local Alloy with neither."""

    def __init__(self, url: str = "http://localhost:4318", instance_id: str = "", token: str = "", service: str = "", sample: float = 1.0) -> None:
        auth = base64.b64encode(f"{instance_id}:{token}".encode()).decode()
        super().__init__(url, {"Authorization": f"Basic {auth}"} if token else {}, service, sample)


class Metric:
    """The two explicit words: `Metric.count("orders.created")`, `Metric.record("checkout.total", total)`."""

    @staticmethod
    def count(name: str, value: int = 1, **attributes: str | int | float | bool) -> None:
        if (found := _instrument(name, "counter")) is not None:
            found.add(value, attributes)

    @staticmethod
    def record(name: str, value: float, **attributes: str | int | float | bool) -> None:
        if (found := _instrument(name, "histogram")) is not None:
            found.record(value, attributes)


def _instrument(name: str, kind: str) -> Any:
    t = _active
    if t is None or t.meter is None:
        return None
    found = t.instruments.get(name)
    if found is None:
        found = t.meter.create_counter(name) if kind == "counter" else t.meter.create_histogram(name)
        t.instruments[name] = found
    return found


def traced[F: Callable[..., Any]](name: str) -> Callable[[F], F]:
    """A span named `name` around the method (the transpiler writes it on each use case's `exec`). A `Result` that is
    an `Err` marks the span as an error with the error's class."""
    attributes = {"synapsis.component": name.split(" › ")[0]}

    def end(span: trace.Span, result: Any) -> Any:
        if isinstance(result, Result) and result.is_err:
            span.set_status(Status(StatusCode.ERROR, type(cast(Result[Any, Any], result).error).__name__))
        return result

    def wrap(fn: F) -> F:
        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def run_async(*args: Any, **kwargs: Any) -> Any:
                tracer = _active.tracer if _active else None
                if tracer is None:
                    return await fn(*args, **kwargs)
                with tracer.start_as_current_span(name, attributes=attributes) as span:
                    return end(span, await fn(*args, **kwargs))

            return cast(F, run_async)

        @functools.wraps(fn)
        def run(*args: Any, **kwargs: Any) -> Any:
            tracer = _active.tracer if _active else None
            if tracer is None:
                return fn(*args, **kwargs)
            with tracer.start_as_current_span(name, attributes=attributes) as span:
                return end(span, fn(*args, **kwargs))

        return cast(F, run)

    return wrap


class _Sampler(Sampler):
    """Drops a trace that starts at an @untraced route (its children go with it), keeps `ratio` of the others."""

    def __init__(self, untraced: set[str], ratio: float) -> None:
        self.untraced = untraced
        self.inner = ParentBased(TraceIdRatioBased(ratio))

    def should_sample(
        self,
        parent_context: Context | None,
        trace_id: int,
        name: str,
        kind: SpanKind | None = None,
        attributes: Attributes = None,
        links: Sequence[Link] | None = None,
        trace_state: trace.TraceState | None = None,
    ) -> SamplingResult:
        root = not trace.get_current_span(parent_context).get_span_context().is_valid
        if root and name in self.untraced:
            return SamplingResult(Decision.DROP)
        return self.inner.should_sample(parent_context, trace_id, name, kind, attributes, links, trace_state)

    def get_description(self) -> str:
        return "synapsis"
